const conn = require("../config/connection.js")
const request = require('request');


const page_size = 10 // 15 notices per page
let chainid = null


function build_dataset(obj_arr, data, agg_map) {
    for (let i = 0; i < obj_arr.length; i++) {
        let curr_obj = obj_arr[i]
        let pos = agg_map.map_func(curr_obj)
        
        if (!data[pos]) {
            data[pos] = []
        }
        data[pos].push(curr_obj.y)
    }

    for (let i = 0; i < data.length; i++) {
        if (!data[i]) {
            data[i] = 0
            continue
        }
        
        let avg = 0
        for (let j = 0; j < data[i].length; j++) {
            avg += data[i][j]
        }
        data[i] = avg / data[i].length
    }
}

function build_ts(ts_dict, min_date, max_date) {
    let labels = []
    let datasets = {}

    let delta = max_date - min_date // delta in milliseconds

    let agg_map = {}

    if (delta <= 86400000) { // <= 1 day(aggregate by hour)
        // can be in different days!!!
        let aux = new Date(`${min_date.getFullYear()}-${min_date.getMonth()+1}-${min_date.getDate()} ${min_date.getHours()}:00:00`)
        while (aux <= max_date) {
            agg_map[`${aux.getDate()} ${aux.getHours()}`] = Object.keys(agg_map).length

            let date = `${aux.getFullYear()}-${aux.getMonth()+1}-${aux.getDate()} ${aux.getHours()}:00:00`
            labels.push(date)

            aux.setHours(aux.getHours()+1)
        }
        agg_map.map_func = function (dt_obj) {
            let key = `${dt_obj.x.getDate()} ${dt_obj.x.getHours()}`
            return this[key] // mapping
        }
    }
    // else if (delta <= 604800017) { // week

    // }
    else if (delta <= 2629800000) { // <= 1 month(aggregate by day)
        // can be in different months!!!
        let aux = new Date(`${min_date.getFullYear()}-${min_date.getMonth()+1}-${min_date.getDate()} 00:00:00`)
        while (aux <= max_date) {
            agg_map[`${aux.getMonth()} ${aux.getDate()}`] = Object.keys(agg_map).length

            let date = `${aux.getFullYear()}-${aux.getMonth()+1}-${aux.getDate()}`
            labels.push(date)

            aux.setDate(aux.getDate()+1)
        }
        agg_map.map_func = function (dt_obj) {
            let key = `${dt_obj.x.getMonth()} ${dt_obj.x.getDate()}`
            return this[key] // mapping
        }
    }
    else if (delta <= 31557600000) { // <= 1 year(aggregate by month)
        let aux = new Date(`${min_date.getFullYear()}-${min_date.getMonth()+1}-01 00:00:00`)
        while (aux <= max_date) {
            agg_map[`${aux.getFullYear()} ${aux.getMonth()}`] = Object.keys(agg_map).length

            let date = `${aux.getFullYear()}-${aux.getMonth()+1}`
            labels.push(date)

            aux.setMonth(aux.getMonth()+1)
        }
        agg_map.map_func = function (dt_obj) {
            let key = `${dt_obj.x.getFullYear()} ${dt_obj.x.getMonth()}`
            return this[key] // mapping
        }
    }
    else { // > 1 year(aggregate by year)
        let aux = new Date(`${min_date.getFullYear()}-01-01 00:00:00`)
        while (aux <= max_date) {
            agg_map[aux.getFullYear()] = Object.keys(agg_map).length

            let date = `${aux.getFullYear()}`
            labels.push(date)

            aux.setFullYear(aux.getFullYear()+1)
        }
        agg_map.map_func = function (dt_obj) {
            let key = dt_obj.x.getFullYear()
            return this[key] // mapping
        }
    }

    for (let key in ts_dict) {
        datasets[key] = new Array(labels.length)
        build_dataset(ts_dict[key], datasets[key], agg_map)
    }

    let result = {"labels": labels, "datasets": datasets}
    return result
}


function has_notices(data) {
    let input
    for (let i = 0; i < data.length; i++) {
        input = data[i]
        if (input.notices.edges.length > 0) {
            return true
        }
    }

    return false
}

module.exports = {
    getNoticePage:async function(filter_options, callback) {
        if (!chainid) {
            chainid = conn.web3.utils.toHex(await conn.web3.eth.getChainId())
            console.log("ChainID:",chainid)
        }

        let options = {
            url: conn.notices_db_url,
            json: true,
            body: {
                query: `
                query notices {
                notices {
                    edges {
                    node {
                        index
                        input {
                        index
                        timestamp
                        msgSender
                        blockNumber
                        }
                        payload
                    }
                    }
                }
                }
                `
            }
        };

        request.post(options, (err, res, body) => {
            if (err) {       
                console.log(err)
                callback(null, null, null, null, chainid, conn.metamask_conn_config)
                return
            }

            if (err) {       
                console.log(err)
                callback(null, null, null, null, chainid, conn.metamask_conn_config)
                return
            }
            

            const inputs_nodes = body.data.notices.edges // list of inputs with its notices
            if (inputs_nodes.length <= 0) {
                callback(null, null, null, null, chainid, conn.metamask_conn_config)
                return
            }
            
            let notices_table = [] // [[payload0,..., payload14], [payload15, ...], ...]
            let time_series = {} // {"bus_line0": [{x: x, y: y}, ...], "bus_line1": [{x: x, y: y}, ...], ...}
            let histogram = [] // [{x: "bus_line0", y: count}]
            let hist_dict = {}
            let min_date
            let max_date

            
            for (let i = 0; i < inputs_nodes.length; i++) {
                let input = inputs_nodes[i]          


                let notice = input.node

                //let payload = JSON.parse(conn.web3.utils.hexToUtf8(notice.payload))
                let payload = JSON.parse(conn.web3.utils.hexToUtf8(notice.payload))
                

                // apply filter
                if (filter_options.filterBusLine && (payload.bus_line != filter_options.filterBusLine)) {
                    continue
                }
                else if (filter_options.fineTypeSelector && (payload.tp != filter_options.fineTypeSelector)) {
                    continue
                }
                payload.input_index = notice.input.index
                
                // populate notices table
                if (notices_table.length > 0 && notices_table[notices_table.length -1].length < page_size) {
                    notices_table[notices_table.length -1].push(payload)
                }
                else {
                    notices_table.push([payload]) // new notice page
                }

                //console.log(payload)
                // populate time series
                let ts_date = new Date(payload.ts)
                if (!(time_series.hasOwnProperty(payload.bus_line))) {
                    time_series[payload.bus_line] = [{x: ts_date, y: payload.value}]
                }
                else {
                    time_series[payload.bus_line].push({x: ts_date, y: payload.value})
                }

                // att min and max ts
                if (!min_date || ts_date < min_date) {
                    min_date = new Date(ts_date.getTime())
                }
                if (!max_date || ts_date > max_date) {
                    max_date = new Date(ts_date.getTime())
                }

                // counting bus_line fine's
                if (!(hist_dict.hasOwnProperty(payload.bus_line))) {
                    hist_dict[payload.bus_line] = 1
                }
                else {
                    hist_dict[payload.bus_line]++
                }
                
            }

            if (notices_table.length == 0) {
                callback(null, null, null, current_epoch, chainid, conn.metamask_conn_config)
                return
            }

            for (let x in hist_dict) {
                histogram.push({x: x, y: hist_dict[x]})
            }

            callback(
                notices_table,
                build_ts(time_series, min_date, max_date),
                histogram,
                chainid,
                conn.metamask_conn_config
            )


        })
    },

    getData:async function(epoch, select, success, error) {
        let options = {
            url: conn.notices_db_url,
            json: true,
            body: {
                query: `
                    query noticesByEpoch {
                        epoch: epochI(index: ${epoch}) {
                            inputs {
                                nodes {
                                    notices {
                                        nodes {
                                            id
                                            index
                                            payload
                                            input {
                                                index
                                                epoch {
                                                    index
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                `
            }
        };

        request.post(options, (err, res, body) => {
            if (err) {       
                console.log(err)
                error("Unable to get data from GraphQl.")
                return
            }

            let response = []
            const inputs_nodes = body.data.epoch.inputs.nodes // list of inputs with its notices
            if (!has_notices(inputs_nodes)) {
                success([]) // return empty array
                return
            }

            let selected_bus_id
            if (select.hasOwnProperty("ts")) {
                let time_series = {} // {"bus_line0": [{x: x, y: y}, ...], "bus_line1": [{x: x, y: y}, ...], ...}
                let min_date
                let max_date
                let aggregate = false
                
                if (select.ts != "*") {
                    selected_bus_id = select.ts
                }
                if (select.agg) {
                    aggregate = true
                }

                for (let i = 0; i < inputs_nodes.length; i++) {
                    let input = inputs_nodes[i]

                    if (input.notices.totalCount == 0) {
                        continue
                    }

                    let notice
                    for (let j = 0; j < input.notices.nodes.length; j++) { // notices of input
                        notice = input.notices.nodes[j]

                        let payload = JSON.parse(conn.web3.utils.hexToUtf8(notice.payload))

                        if (selected_bus_id && payload.bus_line != selected_bus_id) {
                            continue
                        }
    
                        // populate time series
                        let ts_date = new Date(payload.ts)
                        if (!(time_series.hasOwnProperty(payload.bus_line))) {
                            time_series[payload.bus_line] = [{x: ts_date, y: payload.value}]
                        }
                        else {
                            time_series[payload.bus_line].push({x: ts_date, y: payload.value})
                        }
    
                        // att min and max ts
                        if (!min_date || ts_date < min_date) {
                            min_date = new Date(ts_date.getTime())
                        }
                        if (!max_date || ts_date > max_date) {
                            max_date = new Date(ts_date.getTime())
                        }
                    }
                }

                if (aggregate) {
                    response = build_ts(time_series, min_date, max_date)
                }
                else {
                    for (let key in time_series) {
                        time_series[key].sort((a, b) => {
                            return a.x - b.x;
                        });
                    }
                    response = time_series
                }
            }
            else if (select.hasOwnProperty("hist")) {
                let hist_dict = {}

                if (select.hist != "*") {
                    selected_bus_id = select.hist
                }


                for (let i = 0; i < inputs_nodes.length; i++) {
                    let input = inputs_nodes[i]

                    if (input.notices.totalCount == 0) {
                        continue
                    }

                    let notice
                    for (let j = 0; j < input.notices.nodes.length; j++) { // notices of input
                        notice = input.notices.nodes[j]
                        let payload = JSON.parse(conn.web3.utils.hexToUtf8(notice.payload))

                        if (selected_bus_id && payload.bus_line != selected_bus_id) {
                            continue
                        }
    
                        // counting bus_line fine's
                        if (!(hist_dict.hasOwnProperty(payload.bus_line))) {
                            hist_dict[payload.bus_line] = 1
                        }
                        else {
                            hist_dict[payload.bus_line]++
                        }                        
                    }
                }

                for (let x in hist_dict) {
                    response.push({x: x, y: hist_dict[x]})
                }
            }

            success(response)
        })
    },
}