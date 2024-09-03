import sqlite3
from sqlite3 import Error

DATABASE_PATH = "./"

#######################################################
### :desc: create a database connection to the SQLite
###        database specified by db_file.
### :param db_file: database file
### :return: Connection object or None
#######################################################
def create_connection(db_file):
    conn = None
    db_file = DATABASE_PATH + "/" + db_file
    try:
        conn = sqlite3.connect(db_file)
        create_database(db_file, conn)
        return conn
    except Error as e:
        print(e)

    return conn


#######################################################
### :desc: create a table from the create_table_sql 
###        statement.
### :param conn: Connection object
### :param create_table_sql: a CREATE TABLE statement
### :return: None
#######################################################
def create_table(conn, create_table_sql):
    try:
        c = conn.cursor()
        c.execute(create_table_sql)
    except Error as e:
        print(e)


#######################################################
### :desc: create database and database file if it not
###        exists.
### :param DATABASE: file
### :param conn: Connection object
### :return: None
#######################################################
def create_database(DATABASE, conn = None):
    sql_bus_line_table = """ CREATE TABLE IF NOT EXISTS line (
                                id VARCHAR(32),
                                route TEXT,

                                CONSTRAINT PK_line PRIMARY KEY (id)
                            ); """

    sql_trip_schedule_table = """ CREATE TABLE IF NOT EXISTS trip_schedule (
                                id VARCHAR(48),
                                bus_line_id VARCHAR(32),
                                schedule TEXT,

                                CONSTRAINT PK_trip_schedule PRIMARY KEY (id),
                                CONSTRAINT FK_trip_schedule_bus_line FOREIGN KEY (bus_line_id) REFERENCES line(id)
                            ); """

    sql_stop_table = """ CREATE TABLE IF NOT EXISTS stop (
                                stop_order INT,
                                bus_line_id VARCHAR(32),
                                lat FLOAT,
                                lon FLOAT,

                                CONSTRAINT PK_stop PRIMARY KEY (stop_order, bus_line_id),
                                CONSTRAINT FK_stop_line FOREIGN KEY (bus_line_id) REFERENCES line(id)
                            ); """

    sql_bus_data_table = """ CREATE TABLE IF NOT EXISTS bus_data(
                                id VARCHAR(32),
                                bus_line_id VARCHAR(32),
                                lat FLOAT,
                                lon FLOAT,
                                speed FLOAT,
                                ts INT,
                                reject BOOLEAN,
                                
                                CONSTRAINT PK_bus_data PRIMARY KEY (id, ts),
                                CONSTRAINT FK_stop_line FOREIGN KEY (bus_line_id) REFERENCES line(id)
                                )"""
    
    sql_links_table = """CREATE TABLE IF NOT EXISTS links(
                            agent_id VARCHAR(32),
                            target_id VARCHAR(32),
                            epoch INT,

                            CONSTRAINT PK_links PRIMARY KEY (agent_id, target_id, epoch),
                            CONSTRAINT FK_agent_id FOREIGN KEY (agent_id) REFERENCES bus_data(id),
                            CONSTRAINT FK_target_id FOREIGN KEY (target_id) REFERENCES bus_data(id)
                            )"""

    close_at_end = False
    # create a database connection
    if conn is None:
        conn = create_connection(DATABASE)
        close_at_end = True

    # create tables
    if conn is not None:
        # create line table
        create_table(conn, sql_bus_line_table)

        # create trip_schedule table
        create_table(conn, sql_trip_schedule_table)

        # create stop table
        create_table(conn, sql_stop_table)

        # create bus table
        create_table(conn, sql_bus_data_table)

        # create links table
        create_table(conn, sql_links_table)

        if close_at_end: conn.close()
    else:
        print("Error! cannot create the database connection.")


###################################################################
#                                                                 #
#                         AUX FUNCTIONS                           #
#                                                                 #
###################################################################
def str_to_coords(coords_str:str):
    coords = coords_str.split(";")

    for i in range(len(coords)):
        coords[i] = list(map(float, coords[i].split(",")))
    
    return coords

def list_to_str(my_list:list):
    s = ""
    if type(my_list[0]) == list: # coordinates list: [[lat0, lon0], [lat1, lon1],...]
        for coord in my_list:
            s += f"{coord[0]},{coord[1]};" # lat0,lon1;lat1,lon1;lat2,lon2
    else: # schedule list: ['07:45:0', '07:46:0',...]
        for ts in my_list:
            s += f"{ts};"
    
    return s[:-1] # remove last ";"


###################################################################
#                                                                 #
#                            INSERTS                              #
#                                                                 #
###################################################################
def insert_bus_line(conn, bus_line_id, route:list):
    sql = ''' INSERT INTO line(id, route)
              VALUES(?, ?) '''
    cur = conn.cursor()
    route_str = list_to_str(route)
    
    try:
        cur.execute(sql, (bus_line_id, route_str))
        conn.commit()
    except sqlite3.IntegrityError as e:
        return False
    
    return True


def insert_trip_schedule(conn, trip_id, bus_line_id, schedule:list):
    sql = ''' INSERT INTO trip_schedule(id, bus_line_id, schedule)
              VALUES(?, ?, ?) '''
    cur = conn.cursor()

    schedule_str = list_to_str(schedule)

    try:
        cur.execute(sql, (trip_id, bus_line_id, schedule_str))    
        conn.commit()
    except sqlite3.IntegrityError as e:
        return False
    
    return True


def insert_stop(conn, stop_order, bus_line_id, coord:list):
    sql = ''' INSERT INTO stop(stop_order, bus_line_id, lat, lon)
              VALUES(?, ?, ?, ?) '''
    cur = conn.cursor()

    lat, lon = coord

    try:
        cur.execute(sql, (stop_order, bus_line_id, lat, lon))
        conn.commit()
    except sqlite3.IntegrityError as e:
        return False
    
    return True


def insert_bus(conn, id, line_id, lat, lon, spd, ts):
    sql = '''INSERT OR REPLACE INTO bus_data (id, bus_line_id, lat, lon, speed, ts, reject)
              VALUES(?, ?, ?, ?, ?, ?, ?) '''
    cur = conn.cursor()

    try:
        cur.execute(sql, (id, line_id, lat, lon, spd, ts, False))
        conn.commit()
    except sqlite3.IntegrityError as e:
        return False
    
    return True


def insert_link(conn, actor, target, time):
    sql = '''INSERT OR REPLACE INTO links (agent_id, target_id, epoch)
              VALUES(?, ?, ?) '''
    cur = conn.cursor()

    try:
        cur.execute(sql, (actor, target, time))
        conn.commit()
    except sqlite3.IntegrityError as e:
        return False
    
    return True

###################################################################
#                                                                 #
#                            QUERIES                              #
#                                                                 #
###################################################################
def select_lines(conn):
    sql = ''' SELECT * FROM line '''
    cur = conn.cursor()
    cur.execute(sql)

    return cur.fetchall()

def select_lines_id(conn):
    sql = ''' SELECT id FROM line '''
    cur = conn.cursor()
    cur.execute(sql)

    result = []
    for item in cur.fetchall(): # fetchall = [(id0,), (id1,), (id2,), ...]
        result.append(item[0])
    
    return result


def select_line(conn, id):
    sql = ''' SELECT * FROM line WHERE id = ? '''
    cur = conn.cursor()
    cur.execute(sql, (id,))

    result = list(cur.fetchone()) # [id. route_str]
    
    coords_str = result[1]

    result[1] = str_to_coords(coords_str)

    return result


def select_route_of_line(conn, id):
    sql = ''' SELECT route FROM line WHERE id = ? '''
    cur = conn.cursor()
    cur.execute(sql, (id,))

    try:
        coords_str = cur.fetchone()[0]
        route = str_to_coords(coords_str)
    except TypeError as e:
        return None
    
    return route


def select_trip_schedule(conn, trip_id):
    sql = ''' SELECT schedule FROM trip_schedule WHERE id = ? '''
    cur = conn.cursor()
    cur.execute(sql, (trip_id,))

    return cur.fetchone()[0].split(";")


def count_trips(conn, bus_line):
    sql = ''' SELECT COUNT(*) FROM trip_schedule WHERE bus_line_id = ? '''
    cur = conn.cursor()
    cur.execute(sql, (bus_line,))

    return cur.fetchone()[0]

def select_stop_schedule(conn, next_stop, bus_line_id, trip_id):
    result = [None, None]
    
    sql = ''' SELECT lat,lon FROM stop WHERE stop_order = ? AND bus_line_id = ? '''
    cur = conn.cursor()
    cur.execute(sql, (next_stop, bus_line_id))

    result[0] = cur.fetchone()

    sql = ''' SELECT schedule FROM trip_schedule WHERE id = ? '''
    cur = conn.cursor()

    try:
        cur.execute(sql, (trip_id,))
        result[1] = cur.fetchone()[0].split(";")[next_stop-1]
    except TypeError as e:
        return None

    return result
    
    
def select_stops(conn, bus_line_id):    
    sql = ''' SELECT lat,lon,stop_order FROM stop WHERE bus_line_id = ? '''
    cur = conn.cursor()
    cur.execute(sql, (bus_line_id,))

    return cur.fetchall()

def select_last_epoch(conn):    
    sql = ''' SELECT MAX(ts) FROM bus_data '''
    cur = conn.cursor()
    cur.execute(sql,)

    return cur.fetchone()[0]

def select_epoch_bus_list(conn, ts):    
    sql = ''' SELECT * FROM bus_data WHERE ts = ?'''
    cur = conn.cursor()
    cur.execute(sql, (ts,))

    return cur.fetchall()

def select_who_spotted(conn, id, ts):
    sql =''' SELECT agent_id FROM links WHERE target_id = ? AND epoch = ?'''
    cur = conn.cursor()
    cur.execute(sql, (id, ts))

    result = []
    for item in cur.fetchall(): # fetchall = [(id0,), (id1,), (id2,), ...]
        result.append(item[0])
    
    return result

def select_last_proof(conn, id, ts):    
    sql = ''' SELECT * FROM bus_data WHERE id = ? AND ts < ? AND reject = False ORDER BY ts DESC'''
    cur = conn.cursor()
    cur.execute(sql, (id, ts))

    return cur.fetchone()

def select_bus_pos(conn, bus_id, ts):    
    sql = '''SELECT id, lat, lon FROM bus_data WHERE id = ? AND ts = ?'''
    cur = conn.cursor()
    cur.execute(sql, (bus_id, ts))

    return cur.fetchone()

###################################################################
#                                                                 #
#                            UPDATES                              #
#                                                                 #
###################################################################
def set_reject(conn, id, ts):
    sql = ''' UPDATE bus_data SET reject = ? WHERE id = ? AND ts= ? '''
    cur = conn.cursor()

    try:
        cur.execute(sql, (True, id, ts))
        conn.commit()
    except sqlite3.IntegrityError as e:
        return False
    
    return True

if __name__ == "__main__":
    #create_database("schedules.db", None)
    create_connection("schedules.db")
