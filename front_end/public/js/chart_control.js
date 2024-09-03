let colors = [] // color used for each bus_line in graphs

function generate_colors(n) {
    for (let i = 0; i < n; i++) {
        colors.push(get_random_color())
    }
}

class ChartControl {
    constructor(chart_id, chart, data) {
        const ctx = document.getElementById(chart_id).getContext('2d');
        this.chart = new Chart(ctx, {
            type: chart.type,
            options: chart.options,
            datasets: []
        });

        if (data) {
            if (!data.datasets) {
                if (!colors.length) {
                    generate_colors(data.length)
                }

                this.chart.data.datasets.push({
                    backgroundColor: colors,
                    data: data
                })
            }
            else {
                this.chart.data.labels = data.labels
                if (!colors.length) {
                    generate_colors(Object.keys(data.datasets).length)
                }

                let i = 0
                for (let key in data.datasets) {
                    //let color = get_random_color()
                    let color = colors[i]
                    i++;
                    this.chart.data.datasets.push({
                        //labels: data.labels,
                        fill: false,
                        borderColor: color,
                        backgroundColor: color,
                        label: key,
                        data: data.datasets[key]
                    })
                }
            }
        }
       
        // initial data
        //this.query_data(chart.epoch, chart.select)
    }

    query_data(epoch, select) {
        query_chart_data(epoch, select, (response) => {
            console.log(response)
            if (!response.success) {
                console.log(`ERROR: ${response.result}`)
                return
            }
    
            let colors = []
            for (let i = 0; i < response.result.length; i++) {
                colors.push(get_random_color())
            }
            if (this.chart.config.type == 'bar') {
                this.chart.data.datasets.push({
                    backgroundColor: colors,
                    data: response.result
                })
            }
            else if (this.chart.config.type == 'line') {
                for (let key in response.result) {
                    console.log(key)
                }
            }
            this.chart.update()
        })
    }
}