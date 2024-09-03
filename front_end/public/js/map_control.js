let map

async function draw_notice(notice) {
    //let notice = JSON.parse(notice_str)
    let features = []
    let Aux_old = []
    let Aux_approve = []
    let Aux_deny = []
    myStyle.color = get_random_color()
    myStyle.fillColor = myStyle.color
    styleApprov.color = myStyle.color
    styleDeny.color = myStyle.color

    let mark

    if (notice.tp == 1) { // Out of Route Fine
        let curr_coord = [ notice.curr_coords[1], notice.curr_coords[0] ]
        mark = notice.curr_coords

        if (!routes_in_map.hasOwnProperty(notice.bus_line)) {
            let route = []
            await inspect_query({ "select": "routes", "routes": notice.trip.split(';')[0] }, (response) => {
                if (!response.success) {
                    console.log("Failed to inspect route of line ",notice.bus_line)
                    return
                }
                for (let i = 0; i < response.result.length; i++) {
                    route.push([ response.result[i][1], response.result[i][0] ])
                }
    
            })
            console.log(route)

            features.push({
                "type": "LineString",
                "popup": `Route of bus line <span style="color: ${myStyle.color};">${notice.bus_line}</span>.`,
                "coordinates": route
            })
            routes_in_map[notice.bus_line] = myStyle.color
            console.log(routes_in_map)
        }
        else {
            myStyle.color = routes_in_map[notice.bus_line]
            myStyle.fillColor = myStyle.color
        }

        if (!points_in_map.hasOwnProperty(`${notice.epoch_index};${notice.input_index};${notice.bus_line}`)) {
            features.push({
                "type": "Point",
                "popup": `Bus of line <span style="color: ${myStyle.color};">${notice.bus_line}</span> was out of route at <strong>${notice.ts}</strong>.`,
                "coordinates": curr_coord
            })
            points_in_map[`${notice.epoch_index};${notice.input_index};${notice.bus_line}`] = true
            console.log(points_in_map)
        }
    }
    else if (notice.tp == 2) { // Late fine
        let curr_coord = [ notice.curr_stop[1], notice.curr_stop[0] ]
        mark = notice.curr_stop

        if (!points_in_map.hasOwnProperty(`${notice.epoch_index};${notice.input_index};${notice.bus_line}`)) {
            features.push({
                "type": "Point",
                "popup": `Bus of line <span style="color: ${myStyle.color};">${notice.bus_line}</span> was <strong>${notice.late}</strong> late.`,
                "coordinates": curr_coord
            })
            points_in_map[`${notice.epoch_index};${notice.input_index};${notice.bus_line}`] = true
            console.log(points_in_map)
        }
    }else if (notice.tp == 3) { // Lateration refuse
        let curr_coord = [ notice.curr_coords[1], notice.curr_coords[0] ]
        mark = notice.curr_coords

        if (!points_in_map.hasOwnProperty(`${notice.epoch_index};${notice.input_index};${notice.bus_line}`)) {
            features.push({
                "type": "Point",
                "popup": `Bus of line <span style="color: ${myStyle.color};">${notice.bus_line}</span> was declined by <strong>Lateration</strong>.`,
                "coordinates": curr_coord
            })

            console.log(notice.related_pts)
            await inspect_query({ "select": "position", "position": notice.related_pts, "time": notice.ts }, (response) => {
                if (!response.success) {
                    console.log("Failed to inspect neighbors ",notice.bus_line)
                    return
                }
                
                console.log(response.result)
                console.log(notice.related_pts)
                for (let i = 0; i < notice.related_pts.length; i++) {
                    if (notice.agreed_pts.includes(response.result[notice.related_pts[i]][0])){
                        Aux_approve.push({
                            "type": "Point",
                            "popup": response.result[notice.related_pts[i]][0],
                            "coordinates": [response.result[notice.related_pts[i]][2],response.result[notice.related_pts[i]][1]]
                        })
                    }else{
                        Aux_deny.push({
                            "type": "Point",
                            "popup": response.result[notice.related_pts[i]][0],
                            "coordinates": [response.result[notice.related_pts[i]][2],response.result[notice.related_pts[i]][1]]
                        })
                    }
                }

            })
            points_in_map[`${notice.epoch_index};${notice.input_index};${notice.bus_line}`] = true
            console.log(points_in_map)
        }
    }else if (notice.tp == 4) { // Distance refuse
        let curr_coord = [ notice.curr_coords[1], notice.curr_coords[0] ]
        let last_coord = [notice.last_coords[1], notice.last_coords[0]]
        mark = notice.curr_coords

        if (!points_in_map.hasOwnProperty(`${notice.epoch_index};${notice.input_index};${notice.bus_line}`)) {
            Aux_old.push({
                "type": "Point",
                "popup": `Position of <span style="color: ${myStyle.color};">${notice.bus_line}</span> at <strong>${notice.last_ts}</strong>.`,
                "coordinates": last_coord
            })

            Aux_old.push({
                "type": "LineString",
                "coordinates": [last_coord, curr_coord]
            })

            features.push({
                "type": "Point",
                "popup": `Bus of line <span style="color: ${myStyle.color};">${notice.bus_line}</span> exceeded the maximum distance by <strong>${Math.round(notice.excess*1000)}m</strong>.`,
                "coordinates": curr_coord
            })

            points_in_map[`${notice.epoch_index};${notice.input_index};${notice.bus_line}`] = true
            console.log(points_in_map)
        }
    }

    L.geoJSON(Aux_old, {
        style: styleOldActor,
        onEachFeature: (feature, layer) => {layer.bindPopup(feature.popup)},
        pointToLayer: function (feature, latlng) {
            return L.circleMarker(latlng);
        }
    }).addTo(map);

    L.geoJSON(Aux_approve, {
        style: styleApprov,
        onEachFeature: (feature, layer) => {layer.bindPopup(feature.popup)},
        pointToLayer: function (feature, latlng) {
            return L.circleMarker(latlng);
        }
    }).addTo(map);

    L.geoJSON(Aux_deny, {
        style: styleDeny,
        onEachFeature: (feature, layer) => {layer.bindPopup(feature.popup)},
        pointToLayer: function (feature, latlng) {
            return L.circleMarker(latlng);
        }
    }).addTo(map);
    
    L.geoJSON(features, {
        style: myStyle,
        onEachFeature: (feature, layer) => {layer.bindPopup(feature.popup)},
        pointToLayer: function (feature, latlng) {
            return L.circleMarker(latlng);
        }
    }).addTo(map);


    if (mark){
        map.flyTo(mark)
    }
}


function clear_map() {
    map.eachLayer(function (layer) {
        if (!layer._url) {
            map.removeLayer(layer);
        }
    });
    routes_in_map = {}
    points_in_map = {}
}

// MAP GLOBAL VARIABLES
function init_map() {
    map = L.map('map').setView([-22.903929, -43.107258], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(map);

    let bus_id_elem = document.getElementById('fineModalBusId')
    bus_id_elem.onchange = function() {
        inspect_query({ "select": "trips", "trips": bus_id_elem.value }, (res) => {
            if (!res.success) {
                alert(`Error: ${res.result}`)
                return
            }

            let trip_id_elem = document.getElementById('fineModalTripId')
            let trips_html = ""
            for (let i = 1; i <= res.result; i++) {
                trips_html += `<option value=${bus_id_elem.value};${i}> ${bus_id_elem.value};${i} </option>`
            }
            
            trip_id_elem.innerHTML = trips_html
        })
    }

 /*   // to add a fine trhourgh map:
    map.on('click', function(e) {
        let lat = e.latlng.lat
        let lng = e.latlng.lng
        
        let myModalEl = document.getElementById('fineModal')
        
        // get/create modal
        let modal = bootstrap.Modal.getInstance(myModalEl)
        if (!modal) {modal = new bootstrap.Modal(myModalEl)}
        
        let lat_elem = document.getElementById('fineModalLat')
        lat_elem.value = lat
    
        let lng_elem = document.getElementById('fineModalLng')
        lng_elem.value = lng
    
        
        inspect_query({ "select": "lines" }, (res) => {
            if (!res.success) {
                alert(`Error: ${res.result}`)
                return
            }

            let options_html = "<option selected value=''> Seleact a Line </option>"
            for (let i = 0; i < res.result.length; i++) {
                options_html += `<option value=${res.result[i]}> ${res.result[i]} </option>`
            }

            bus_id_elem.innerHTML = options_html
        })

        modal.toggle()
    } );*/
}



var myStyle = {
    "color": null,
    "fillColor": null,
    "weight": 3,
    "opacity": 1.0,
    "fillOpacity": 1.0,
    "radious": 10
};

var styleOldActor = {
    "color": "#000000",
    "fillColor": "#000000",
    "weight": 1,
    "opacity": 0.6,
    "fillOpacity": 0.6,
    "radious": 4
};

var styleApprov= {
    "color": null,
    "fillColor": "#028A0F",
    "weight": 3,
    "opacity": 1.0,
    "fillOpacity": 1.0,
    "radious": 4
};

var styleDeny= {
    "color": null,
    "fillColor": "#900603",
    "weight": 3,
    "opacity": 1.0,
    "fillOpacity": 1.0,
    "radious": 4
};

var routes_in_map = {} // { bus_line: boolean }
var points_in_map = {} // { "epoch_index;input_index": boolean }
