from os import environ
import logging
import requests

import json
import db_manager as db
import util
import os.path

DB_FILE = "schedules.db"
REACH = 0.2

logging.basicConfig(level="INFO")
logger = logging.getLogger(__name__)

rollup_server = environ["ROLLUP_HTTP_SERVER_URL"]
logger.info(f"HTTP rollup_server url is {rollup_server}")

def fine_check(conn, bus_id, trip_id, curr_lat, curr_lon, ts):
    fine_dsc = None
    route_id = trip_id.split(';')[0]
    route = db.select_route_of_line(conn, route_id)
    
    if route is None:
        logger.info(f"Route unavailable for {bus_id}")
    else:
        logger.info(f"Route available: {route_id}")
        in_route = util.in_route(curr_lat, curr_lon, route)
        if in_route is not True:
            logger.info(f"Out of route: {route_id}")
            fine_dsc = {
                "ts": util.int_to_date(ts),
                "tp": 1,                                    # type 1: different route
                "dsc": "Out of route",
                #"expected_route": route,
                "distance": round(in_route,2),
                "curr_coords": (curr_lat, curr_lon),
                "bus_line": bus_id,
                "trip": trip_id,
                "value": 88.38          
            }
        else: # is on route
            # get stop
            logger.info(f"In route: {route_id}")
            stops = db.select_stops(conn, route_id)
            #logger.info(stops)
            stop_id = util.next_stop(curr_lat, curr_lon, stops)

            # check schedule
            if stop_id is not None: # arrived at next_stop
                result = db.select_stop_schedule(conn, stop_id, route_id, trip_id)
                if result is None:
                    logger.info(f"Stop unavailable for {bus_id}")
                else:                                
                    stop, stop_time = result
                    late = util.is_late(ts, stop_time)
            
                    if late:
                        fine_dsc = {
                            "ts": util.int_to_date(ts),
                            "tp": 2,                                # type 2: late, according to Schedule
                            "dsc": "Late, according to Schedule",
                            "curr_stop": stop,
                            "late": str(late),                      # how much is late
                            "bus_line": bus_id,
                            "trip": trip_id,
                            "value": 88.38  
                        }
    return fine_dsc

def get_bus_position(conn, id, ts):
    ts_int = util.date_to_int(ts)    
    return db.select_bus_pos(conn, id, ts_int)


def handle_advance(data):
    try:
        #logger.info(f"Received advance request data {data}")

        ### payload to UTF-8
        payload_utf8 = util.hex_to_str(data["payload"])
        #logger.info(f"Payload UTF-8 {payload_utf8}")

        ### managing database
        conn = db.create_connection(DB_FILE)

        try:
            payload_dict = json.loads(payload_utf8)
        except json.decoder.JSONDecodeError:
            conn.close()
            return "reject"

        #### is new Schedule
        if "new_schedule" in payload_dict:
            count = 0
            bus_id = payload_dict["bus_id"] # bus line id       
            route = payload_dict["route"]    
            stops = payload_dict["stops"]
            schedules = payload_dict["schedule"]     

            if not db.insert_bus_line(conn, bus_id, route):
                conn.close()
                return "reject"
            
            for schedule in schedules:
                count += 1
                trip_id = f"{bus_id};{count}"
                if not db.insert_trip_schedule(conn, trip_id, bus_id, schedule):
                    conn.close()
                    return "reject"
            
            stop_id = 0
            for stop in stops:
                stop_id += 1
                if not db.insert_stop(conn, stop_id, bus_id, stop):
                    conn.close()
                    return "reject"

        else:
            bus_id = payload_dict["bus_id"]
            trip_id = payload_dict["trip_id"]
            curr_lat = payload_dict["lat"]
            curr_lon = payload_dict["lon"]
            curr_spd = payload_dict["spd"]
            ts = payload_dict["ts"]
            links = payload_dict["links"]

            if isinstance(ts, str):
                ts = util.date_to_int(ts)

            epoch = util.find_epoch(ts)
            last_epoch = db.select_last_epoch(conn)

            if last_epoch == None or last_epoch == epoch:
                db.insert_bus(conn, bus_id, trip_id, curr_lat, curr_lon, curr_spd, epoch)
                for target_id in links:
                    db.insert_link(conn,bus_id, target_id, epoch)
                logger.info(f"saving input :{bus_id}")
            elif last_epoch > epoch:
                conn.close()
                return "reject"
            else:
                #new epoch -> Recover [v] , validate [v] and check for fines [v] inputs fron last epock
                db.insert_bus(conn, bus_id, trip_id, curr_lat, curr_lon, curr_spd, epoch)
                for target_id in links:
                    db.insert_link(conn,bus_id, target_id, epoch)
                logger.info(f"saving input :{bus_id}")


                epoch_colection = db.select_epoch_bus_list(conn, last_epoch)
                logger.info("new epoch")
                logger.info(epoch_colection)

                for bus_msg in epoch_colection:
                    msg_bus_id, msg_trip_id, msg_curr_lat, msg_curr_lon, msg_curr_spd, msg_ts, msg_status = bus_msg

                    fine_dsc = fine_check(conn, msg_bus_id, msg_trip_id, msg_curr_lat, msg_curr_lon, msg_ts)
                    logger.info(f"Fine check :{fine_dsc}")

                    if fine_dsc == None:
                        logger.info(f"Beginning position validation for {msg_bus_id}")
                        curr_spot = db.select_who_spotted(conn, msg_bus_id, msg_ts)

                        curr_near = []
                        for line in epoch_colection:
                            if line[0] != msg_bus_id:
                                if util.distance_between_coordinates(line[2], line[3], msg_curr_lat,msg_curr_lon) <= REACH: curr_near.append(line[0])


                        total_pts =  list(set(curr_near+curr_spot))
                        approve_pts = list(set(curr_near).intersection(curr_spot))   

                        logger.info(f"total_pts: {total_pts}")
                        logger.info(f"approve_pts: {approve_pts}")
                        if len(total_pts)>= 4:
                            if(len(approve_pts)<= len(total_pts)/2):
                                logger.info("reject")
                                #reject   
                                db.set_reject(conn, msg_bus_id, msg_ts)

                                fine_dsc = {
                                        "ts": util.int_to_date(msg_ts),
                                        "tp": 3,
                                        "bus_line": msg_bus_id,
                                        "dsc": "Rejected other peers",
                                        "curr_coords": (msg_curr_lat, msg_curr_lon),
                                        "related_pts": total_pts,
                                        "agreed_pts": approve_pts,
                                        "bus_line": msg_bus_id,
                                        "trip": msg_trip_id,
                                        "value": 130.16
                                    }
                        else:
                            last_proof = db.select_last_proof(conn, msg_bus_id,msg_ts)
                            if last_proof:
                                last_bus_id, last_trip_id, last_lat, last_lon, last_spd, last_ts, last_status = last_proof
                                delta_t = (msg_ts - last_ts)
                                logger.info(f"Time dif: {delta_t}")
                                max_acc = 2.81
                                max_dist = (last_spd/3.6*delta_t + (max_acc* pow(delta_t, 2))/2)/1000
                                logger.info(f"Max distance: {max_dist}")
                                delta_s = util.distance_between_coordinates(msg_curr_lat, msg_curr_lon, last_lat, last_lon)
                                logger.info(f"Real distance: {delta_s}")
                                
                                if delta_s > max_dist:
                                    logger.info("reject")
                                    #reject   
                                    db.set_reject(conn, msg_bus_id, msg_ts)
                                    fine_dsc = {
                                            "ts": util.int_to_date(msg_ts),
                                            "tp": 4,
                                            "bus_line": msg_bus_id,
                                            "dsc": "Rejected for exceeding the maximum travel distance",
                                            "curr_coords": (msg_curr_lat, msg_curr_lon),
                                            "last_ts": util.int_to_date(last_ts),
                                            "last_coords": (last_lat, last_lon),
                                            "excess": (delta_s-max_dist),
                                            "bus_line": msg_bus_id,
                                            "trip": msg_trip_id,
                                            "value": 130.16
                                        }

                    
                    if fine_dsc:
                        notice_payload = util.str_to_eth_hex(json.dumps(fine_dsc))
                        # logger.info("### Notice Payload ###")
                        # logger.info(notice_payload)
                        # logger.info("### Notice Payload ###")
                        logger.info("Adding notice")
                        response = requests.post(rollup_server + "/notice", json={ "payload": notice_payload })
                        logger.info(f"Received notice status {response.status_code} body {response.content}")

                

        conn.close()
        return "accept"
    except Exception as e:
        logger.info(f"Unexpected Error: {e}\nRejecting...")
        conn.close()
        return "reject"

def handle_inspect(data):
    try:
        ### payload to UTF-8
        payload_utf8 = util.hex_to_str(data["payload"])
        logger.info(f"Inspect Payload UTF-8 {payload_utf8}")

        payload_dict = json.loads(payload_utf8)
        logger.info(f"Payload DICT {payload_dict}")

        def generate_report(msg):
            result = util.str_to_eth_hex(msg)
            logger.info("Adding report")
            response = requests.post(rollup_server + "/report", json={"payload": result})
            logger.info(f"Received report status {response.status_code}")


        if "select" not in payload_dict:
            generate_report(f"Must have 'select' key! Valid values are: {list(select_options.keys())}")
            return "reject"

            
        conn = db.create_connection(DB_FILE)
        option = payload_dict["select"]
        select_options = {
            "lines": { "required": False, "function": db.select_lines_id },
            "routes": { "required": True, "function": db.select_route_of_line },
            "trips": { "required": True, "function": db.count_trips },
            "position": {"required": True, "time": True, "function": get_bus_position }
        }
        

        if option not in select_options:
            generate_report(f"Invalid select option! Valid options are: {list(select_options.keys())}")
            return "reject"

        select_function = select_options[option]["function"]
        if not select_options[option]["required"]:
            result = select_function(conn)
        else:
            if option not in payload_dict:
                generate_report(f"Missing key: {option}")
                return "reject"

            option_value = payload_dict[option]
            if type(option_value) == str:
                result = select_function(conn, option_value)
            elif type(option_value) == list:
                result = {}
                for val in option_value:
                    if select_options[option]["time"]:         
                        result[val] = select_function(conn, val, payload_dict["time"])
                    else:
                        result[val] = select_function(conn, val)
            else:
                generate_report(f"{option} value must be a list or a string!")
                return "reject"
                

        generate_report(json.dumps(result))
        return "accept"
    
    except Exception as e:
        logger.info(f"Unexpected Error: {e}\nRejecting...")
        return "reject"


handlers = {
    "advance_state": handle_advance,
    "inspect_state": handle_inspect,
}

finish = {"status": "accept"}

while True:
    logger.info("Sending finish")
    response = requests.post(rollup_server + "/finish", json=finish)
    logger.info(f"Received finish status {response.status_code}")
    if response.status_code == 202:
        logger.info("No pending rollup request, trying again")
    else:
        rollup_request = response.json()
        data = rollup_request["data"]
        handler = handlers[rollup_request["request_type"]]
        finish["status"] = handler(rollup_request["data"])
