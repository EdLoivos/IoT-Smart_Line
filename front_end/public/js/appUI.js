//const navbar_height = 58 + 16 + 1 // navbar + padding + border-bottom
const navbar_height = 71 // navbar + padding + border-bottom
const div_margin = 48 // map parent div margin
const graphs_margin = 8 // margin added to position graphs


class AppUI {
    constructor(map_id, histogram, timeSeries) {
        // UI elements
        this.map_id = map_id
        this.histogram_conf = histogram
        this.timeSeries_conf = timeSeries

        // set initial map height
        this.prepare_elements()

        // window.addEventListener('resize', () => {
        //     this.prepare_elements()
        // });

        // make charts minizable
        this.chart_btn_on_click(this.histogram_conf)
        this.chart_btn_on_click(this.timeSeries_conf)

        // make element draggable
        this.dragElement(document.getElementById(this.histogram_conf.div_id))
        this.dragElement(document.getElementById(this.timeSeries_conf.div_id))
    }

    //-------------------------------------------
    //  Window Resize functions
    //-------------------------------------------
    prepare_elements() {
        document.getElementById(this.map_id).style.height = `${window.innerHeight - navbar_height - div_margin*2}px`

        let histogram_elem = document.getElementById(this.histogram_conf.div_id)
        histogram_elem.style.top = (navbar_height + div_margin + graphs_margin)+ "px"
        histogram_elem.style.left = (window.innerWidth - this.histogram_conf.div_width - div_margin - graphs_margin) + "px"

        let timeSeries_elem = document.getElementById(this.timeSeries_conf.div_id)
        //timeSeries_elem.style.top = navbar_height + "px"
        timeSeries_elem.style.top = (window.innerHeight / 2 - graphs_margin) + "px"
        timeSeries_elem.style.left = (window.innerWidth - this.timeSeries_conf.div_width - div_margin - graphs_margin) + "px"

    }

    //-------------------------------------------
    //  Minimize event
    //-------------------------------------------
    chart_btn_on_click(chart) {
        let div = document.getElementById(chart.div_id)

        $("#"+chart.btn_minimize_id).click(() => {
            div.classList.add('visually-hidden');
        })

        $("#"+chart.btn_id).click(() => {
            div.classList.toggle('visually-hidden');
        })
    }


    //-------------------------------------------
    //  Element Draggable function
    //-------------------------------------------
    dragElement(elmnt) {
        var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        if (document.getElementById(elmnt.id + "Header")) {
            // if present, the header is where you move the DIV from:
            document.getElementById(elmnt.id + "Header").onmousedown = dragMouseDown;
        } else {
            // otherwise, move the DIV from anywhere inside the DIV:
            elmnt.onmousedown = dragMouseDown;
        }

        function dragMouseDown(e) {
            e = e || window.event;
            e.preventDefault();
            // get the mouse cursor position at startup:
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            // call a function whenever the cursor moves:
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e = e || window.event;
            e.preventDefault();
            // calculate the new cursor position:
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            
            // verify if the div is inside screen
            let new_top = elmnt.offsetTop - pos2
            let new_left = elmnt.offsetLeft - pos1
            if (new_left + elmnt.offsetWidth >= window.innerWidth || new_left <= 0) {
                return
            }

            if (new_top + elmnt.offsetHeight >= window.innerHeight || new_top <= navbar_height) {
                return
            }

            // set the element's new position:
            elmnt.style.top = new_top + "px";
            elmnt.style.left = new_left + "px";
        }

        function closeDragElement() {
            // stop moving when mouse button is released:
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }
}