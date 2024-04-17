// TODO: Võrgutasud ei sisalda riikliku pühi
import { Chart, LinearScale, CategoryScale, BarController, BarElement, Legend, Tooltip } from 'chart.js'
Chart.register(LinearScale, CategoryScale, BarController, BarElement, Legend, Tooltip)

type TooltipItem = {
  label: string
  parsed: {
    x: number,
    y: number
  }
}

type DataPoint = {
  x: string
  y: string | number
}

class NordpoolChart extends HTMLElement {
  #canvas!: HTMLCanvasElement
  #chart: any
  #shadowRoot: ShadowRoot
  #UPDATE_TIME = 15
  #settings = {
    transferType: 5,
    transferTypes: {
      1: {
        day: 8.8,
      },
      2: {
        day: 10.59,
        night: 6.16
      },
      3: {
        day: 6.92,
        night: 4.00
      },
      4: {
        day: 4.50,
        night: 2.56
      },
      5: {
        day: 6.27,
        dayPeak: 9.69,
        night: 3.6,
        weekendPeak: 5.61,
      },
    },
  }
  #style: string = `
#settingsBtn {
  color: green;
  position: absolute;
  top: 0;
  left: 0;
}
:host {
  height: 100%;
  display: block;
}
::backdrop {
  background-image: linear-gradient(
    45deg,
    magenta,
    rebeccapurple,
    dodgerblue,
    green
  );
  opacity: 0.75;
}

dialog {
  padding: 0;
}
dialog p {
  padding: 0;
  margin: 0;
}
dialog #close {
  position: absolute;
  right: 2px;
  top: 2px;
}

.mt-2 {
  margin-top: 0.75rem;
}

.settings-container {
  height: 100%;
  width: 100%;
  margin-top: 20px;
  margin-bottom: 3px;
}
`

  constructor() {
    super()

    this.#shadowRoot = this.attachShadow({ mode: 'open' })
      this.loadSettings()
      this.makeCanvas()
      this.makeSettings()
      this.makeStyle()
      this.makeChart()
  }

  makeChart() {
    this.getThreeDaysData().then((data) => {
      let transferPrice: number[] = [...this.type5Price(), ...this.type5Price()]
      if (this.#settings.transferType === 4) {
        transferPrice = [...this.type4Price(), ...this.type4Price()]
      }
      if (this.#settings.transferType === 3) {
        transferPrice = [...this.type3Price(), ...this.type3Price()]
      }
      if (this.#settings.transferType === 2) {
        transferPrice = [...this.type2Price(), ...this.type2Price()]
      }
      if (this.#settings.transferType === 1) {
        transferPrice = [...this.type1Price(), ...this.type1Price()]
      }

      let currentPrice = '0.0'
      let currentTransferPrice = 0.0

      const currentDate = this.currentDateString()

      let combinedData: DataPoint[]
      if (new Date().getHours() >= this.#UPDATE_TIME) {
        combinedData = data.current.concat(data.needed)
      } else {
        combinedData = data.needed.concat(data.current)
      }
      
      let transferPriceMap = transferPrice.map((price, index) => {
        return {
          x: combinedData[index].x,
          y: price,
        }
      })

      
      const colors = combinedData.map((dataPoint, index) => {
        if (currentDate === dataPoint.x) {
          currentPrice = dataPoint.y as string
          currentTransferPrice = transferPriceMap[index].y
          return 'MediumAquamarine'
        }
        return '#9ad0f5'
      })

      if (this.#chart) {
        this.#chart.destroy()
      }
      
      // @ts-ignore Chart not defined
      this.#chart = new Chart(this.#canvas, {
        type: 'bar',
        data: {
          datasets: [
            {
              label: `Võrgutasu ${currentTransferPrice} s/kWh`,
              data: transferPriceMap,
              backgroundColor: '#39A0E5',
              hoverBorderColor: 'green',
              hoverBorderWidth: 3,
              barPercentage: 1,
            },
            {
              label: `Elekter ${currentPrice} s/kWh`,
              data: combinedData,
              backgroundColor: colors,
              hoverBorderColor: 'green',
              hoverBorderWidth: 3,
              barPercentage: 1,
            },
            {
              label: `Kokku ${Number(Number(currentTransferPrice) + Number(currentPrice)).toFixed(2)} s/kWh`,
              backgroundColor: 'orange',
              data: []
            },
          ],
        },
        options: {
          maintainAspectRatio: false,
          interaction: {
            intersect: false,
            mode: 'index',
          },
          plugins: {
            legend: {
              labels: {
                font: {
                  size: 36,
                },
              },
            },
            tooltip: {
              titleFont: {
                size: 24,
              },
              bodyFont: {
                size: 24,
              },
              callbacks: {
                label: (tooltipItem: TooltipItem) => {
                  return ` ${tooltipItem.parsed.y} s/kWh`
                },
                footer: (tooltipItems: TooltipItem[]) => {
                  let sum = 0

                  tooltipItems.forEach((tooltipItem) => {
                    sum += tooltipItem.parsed.y
                  })
                  return 'Kokku: ' + Number(sum).toFixed(2)
                },
                title: (tooltipItem: {label: string}[]) => {
                  return tooltipItem[0].label.replace('T', '\n')
                },
              },
            },
          },
          scales: {
            y: {
              stacked: true,
              ticks: {
                // Format of numbers on Y scale on the left
                callback: (val) => {
                  return `${val} s/kWh`
                },
              },
            },
            x: {
              stacked: true,
              ticks: {
                callback: function (val) {
                  return ((this as any).getLabelForValue(val) as string).split('T')[1].split(':')[0]
                },
              },
            },
          },
        },
      })
    })
  }

  static get observedAttributes () {
    return ['apiUrl']
  }

  get apiUrl() {
    return this.getAttribute('apiUrl') || window.location.origin
  }

  makeStyle() {
    let template = document.createElement('style')
    template.innerHTML = this.#style
    this.#shadowRoot.append(template)
  }

  loadSettings() {
    let settings = localStorage.getItem('nordpool-chart-settings')
    if (!settings) {
      return
    }
    this.#settings.transferType = JSON.parse(settings).transferType
  }

  makeSettings() {
    const settingsBtn = document.createElement('button')
    settingsBtn.id = 'settingsBtn'
    settingsBtn.innerText = 'Seaded'
    this.#shadowRoot.append(settingsBtn)

    const dialog = document.createElement('dialog')
    dialog.onmousedown = (event) => {
      const closeButton = this.#shadowRoot.getElementById("close");
      if (event.target === closeButton) {
        dialog.close()
      }
      event.target == dialog && dialog.close()
    }
    dialog.innerHTML = `
    <div class="settings-container">
      <button id="close">X</button>
      <form id="settings">
        <fieldset>
          <legend>Vali võrguteenus</legend>
        
          <div class="mt-2">
            <input type="radio" id="transfer_1" name="transfer" value="1" ${this.#settings.transferType === 1 ? "checked" : ''} />
            <label for="transfer_1">Võrk 1</label>
          </div>
        
          <div class="mt-2">
            <input type="radio" id="transfer_2" name="transfer" value="2" ${this.#settings.transferType === 2 ? "checked" : ''} />
            <label for="transfer_2">Võrk 2</label>
          </div>
        
          <div class="mt-2">
            <input type="radio" id="transfer_3" name="transfer" value="3" ${this.#settings.transferType === 3 ? "checked" : ''} />
            <label for="transfer_3">Võrk 2 kuutasuga</label>
          </div>
        
          <div class="mt-2">
            <input type="radio" id="transfer_4" name="transfer" value="4" ${this.#settings.transferType === 4 ? "checked" : ''} />
            <label for="transfer_4">Võrk 4</label>
          </div>
        
          <div class="mt-2">
            <input type="radio" id="transfer_5" name="transfer" value="5" ${this.#settings.transferType === 5 ? "checked" : ''} />
            <label for="transfer_5">Võrk 5</label>
          </div>
          <input type="submit" value="Salvesta" class="mt-2"></input>
        </fieldset>
      </form>
    </div>
    `
    this.#shadowRoot.append(dialog)
    

    // "Show the dialog" button opens the dialog modally
    settingsBtn.addEventListener("click", () => {
      dialog.showModal();
    });

    setTimeout(() => {
      const form = this.#shadowRoot.querySelector('#settings')! as HTMLFormElement
      form.addEventListener('submit', (e) => {
        e.preventDefault()
        const formData = new FormData(e.target as HTMLFormElement);
        const formProps = Object.fromEntries(formData);
        if (this.#settings.transferType === Number(formProps.transfer)) {
          // Same, do nothing
          return
        }
        this.#settings.transferType = Number(formProps.transfer)

        // Save settings
        localStorage.setItem('nordpool-chart-settings', JSON.stringify({
          transferType: this.#settings.transferType
        }))
        dialog.close()
        this.makeChart()
      })
    });
  }

  makeCanvas() {
    this.#canvas = document.createElement('canvas')
    this.#canvas.id = 'nordpool-chart'
    this.#shadowRoot.append(this.#canvas)
    this.#shadowRoot.styleSheets
  }

  currentDateString() {
    const date = new Date()
    const day = String(date.getDate()).padStart(2, '0')
    // Months are 0-indexed
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    const hours = String(date.getHours()).padStart(2, '0')

    return `${day}.${month}.${year}T${hours}:00`
  }

  async getDataForDate(date: Date) {
    const response = await fetch(
      `${this.apiUrl}/api/ee?day=${date.getDate()}&month=${date.getMonth()}&year=${date.getFullYear()}&currency=EUR`
    )
    const data = await response.json()
    return data
  }

  async getThreeDaysData() {
    const currentDate = new Date()

    let neededDate
    neededDate = new Date(currentDate)

    if (new Date().getHours() >= this.#UPDATE_TIME) {
      neededDate.setDate(currentDate.getDate() + 1)
    } else {
      neededDate.setDate(currentDate.getDate() - 1)
    }

    const [currentData, neededData] = await Promise.all([
      this.getDataForDate(currentDate),
      this.getDataForDate(neededDate),
    ])

    return { needed: neededData, current: currentData }
  }

  type1Price() {
    let hours = [...new Array(24)]
      .map(() => {
        return this.#settings.transferTypes[1].day
      }) 
    return hours
  }

  type2Price() {
    let hours = [...new Array(24)] // Create mappable array
    const today = new Date()

    let isWeekend = false
    // Check if Sunday or Monday
    if (today.getDay() === 0 || today.getDay() === 6) {
      // Is weekend
      isWeekend = true
    }

    return hours.map((_, index) => {
      // Deal with weekends
      if (isWeekend) {
        // Weekend is same as night
        return this.#settings.transferTypes[2].night
      }

      // Weekday day
      if (index >= 7 && index <= 22) {
        return this.#settings.transferTypes[2].day
      }

      // Weekday nights
      return this.#settings.transferTypes[2].night
    })
  }

  type3Price() {
    let hours = [...new Array(24)] // Create mappable array
    const today = new Date()

    let isWeekend = false
    // Check if Sunday or Monday
    if (today.getDay() === 0 || today.getDay() === 6) {
      // Is weekend
      isWeekend = true
    }

    return hours.map((_, index) => {
      // Deal with weekends
      if (isWeekend) {
        // Weekend is same as night
        return this.#settings.transferTypes[3].night
      }

      // Weekday day
      if (index >= 7 && index <= 22) {
        return this.#settings.transferTypes[3].day
      }

      // Weekday nights
      return this.#settings.transferTypes[3].night
    })
  }

  type4Price() {
    let hours = [...new Array(24)] // Create mappable array
    const today = new Date()

    let isWeekend = false
    // Check if Sunday or Monday
    if (today.getDay() === 0 || today.getDay() === 6) {
      // Is weekend
      isWeekend = true
    }

    return hours.map((_, index) => {
      // Deal with weekends
      if (isWeekend) {
        // Weekend is same as night
        return this.#settings.transferTypes[4].night
      }

      // Weekday day
      if (index >= 7 && index <= 22) {
        return this.#settings.transferTypes[4].day
      }

      // Weekday nights
      return this.#settings.transferTypes[4].night
    })
  }

  type5Price() {
    let hours = [...new Array(24)] // Create mappable array
    const today = new Date()

    let isWeekend = false
    // Check if Sunday or Monday
    if (today.getDay() === 0 || today.getDay() === 6) {
      // Is weekend
      isWeekend = true
    }

    // 0 - jan
    // 1 - feb
    // 2 - mar
    // 3 - apr
    // 4 - mai
    // 5 - jun
    // 6 - jul
    // 7 - aug
    // 8 - sept
    // 9 - okt
    // 10 - nov
    // 11 - dec
    let month = today.getMonth()

    return hours.map((_, index) => {
      // Deal with weekends
      if (isWeekend) {
        // Weekend peak
        if (index >= 16 && index <= 20 && [10, 11, 0, 1, 2].includes(month)) {
          return this.#settings.transferTypes[5].weekendPeak
        }
        // Weekend is same as night
        return this.#settings.transferTypes[5].night
      }

      // Weekday peaks
      if (((index >= 9 && index <= 12) || (index >= 16 && index <= 20)) && [10, 11, 0, 1, 2].includes(month)) {
        return this.#settings.transferTypes[5].dayPeak
      }

      // Weekday day
      if (index >= 7 && index <= 22) {
        return this.#settings.transferTypes[5].day
      }

      // Weekday nights
      return this.#settings.transferTypes[5].night
    })
  }
}

customElements.define('nordpool-chart', NordpoolChart)
