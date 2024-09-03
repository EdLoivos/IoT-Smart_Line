let url // next epoch URL
let curr_page = 1

function build_url() {
    url = "/?"

    if (filter_options.filterBusLine) {
        url += `filterBusLine=${filter_options.filterBusLine}`
    }
    if (filter_options.fineTypeSelector) {
        if (url.length != 2) {
            url += '&'
        }
        url += `fineTypeSelector=${filter_options.fineTypeSelector}`
    }
    if (url.length != 2) {
        url += '&'
    }    
}


function notices_count_info() {
    let info = {"begin": 1, "end": undefined, "total": 0}

    // calc begin
    for (let i = 0; i < curr_page-1; i++) {
        info.begin += notices_table[i].length
    }

    // calc end
    info.end = info.begin + notices_table[curr_page-1].length -1

    for (let i = 0; i < notices_table.length; i++) {
        info.total += notices_table[i].length
    }

    return info
}

//function build_table(table_id, pagination_id, pagination_info_id) {
function build_table(table_id, pagination_div_id) {
    let pagination_div_elem = document.getElementById(pagination_div_id)

    let table_elem = document.getElementById(table_id+"Body")
    let pagination_info_elem = pagination_div_elem.getElementsByTagName("div")[0] //pagination_div_elem.children[0]
    let pagination_elem = pagination_div_elem.getElementsByTagName("nav")[0].children[0] //pagination_div_elem.children[1].children[0]


    if (!notices_table) {
        table_elem.innerHTML = '<tr><td colspan="3" class="text-center">No data to show</td></tr>'
        pagination_elem.innerHTML = ''
        pagination_info_elem.innerHTML = ''
        return
    }

    pagination_div_elem.classList.add("p-1")

    if (!url) {
        build_url()
    }

    // building table body
    table_elem.innerHTML = ""
    for (let i = 0; i < notices_table[curr_page-1].length; i++) {
        let notice = notices_table[curr_page-1][i]
        let icon_html
        if (notice.tp == 1) {
            icon_html = '<span class="material-icons fs-6" data-bs-toggle="tooltip" title="Out of route">directions_off</span>'
        } else if (notice.tp == 2){
            icon_html = '<span class="material-icons fs-6" data-bs-toggle="tooltip" title="Late">pending_actions</span>'
        } else {
            icon_html = '<span class="material-icons fs-6" data-bs-toggle="tooltip" title="Disputed position">error_outline</span>'
        }


        let tr_html = ''
        + `<tr class="clickable-row" id="${notice.input_index};${notice.bus_line}">`
        + `<td>${notice.bus_line}</td>`
        + `<td class="text-center">${notice.ts}</td>`
        + `<td class="text-end">${icon_html}</td>`
        + `<td class="text-end">${notice.value}</td>`
        + `</tr>`

        table_elem.insertAdjacentHTML("beforeend", tr_html)
        document.getElementById(`${notice.input_index};${notice.bus_line}`).onclick = () => {draw_notice(notice)}
    }    
    
    
    // building table pagination
    let prev_disabled = "" // previous page button state
    let next_disabled = "" // next page button state
    let pagination_html = ''
    let prev_btn_html
    let next_btn_html
    let first_page_btn_html
    let last_page_btn_html
    let last_page = notices_table.length
    let info = notices_count_info()

    // add notices count info
    pagination_info_elem.innerHTML = `
        <span class="text-muted" style="font-size: 20px;padding: 6px">
            ${info.begin}-${info.end} of ${info.total}
        </span>
    `


    // page check
    if (curr_page == 1) {
        prev_disabled = "disabled"


    }
    if (curr_page == last_page) {
        next_disabled = "disabled"
        

    }

    
    // first page button
    first_page_btn_html = `
        <li class="page-item ${prev_disabled}">
            <button class="page-link btn btn-white border-0 fs-5 material-icons" 
                onclick="page_change('${table_id}','${pagination_div_id}',${1})" title="First-Page" >
                    first_page 
            </button>
        </li>
    `

    
    // previous button
    prev_btn_html = `
        <li class="page-item ${prev_disabled}">
            <button class="page-link btn btn-white border-0 fs-5 material-icons"
            onclick="page_change('${table_id}','${pagination_div_id}',${curr_page-1})"
            title="Previous-Page" >
                chevron_left
            </button>
        </li>
    `
    
    pagination_html += first_page_btn_html + prev_btn_html

    // next button
    next_btn_html = `
        <li class="page-item ${next_disabled}">
            <button class="page-link btn btn-white border-0 fs-5 material-icons"
            onclick="page_change('${table_id}','${pagination_div_id}',${curr_page+1})"
            title="Next-Page">
                chevron_right
            </button>
        </li>
    `

    // last page button
    last_page_btn_html = `
        <li class="page-item ${next_disabled}">
            <button class="page-link btn btn-white border-0 fs-5 material-icons"
            onclick="page_change('${table_id}','${pagination_div_id}',${last_page})"
            title="Last-Page">
                last_page
            </button>
        </li>
    `
    
    pagination_html += next_btn_html + last_page_btn_html
    pagination_elem.innerHTML = pagination_html

    
}

function page_change(table_id, pagination_div_id, page) {
    curr_page = page
    build_table(table_id, pagination_div_id)
}