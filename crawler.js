// import puppeteer library
const puppeteer = require('puppeteer')
const { Client } = require('pg');


async function insertBancoConsorcio(client, data) {
    await client.query('DELETE FROM orders WHERE bank_id = 2')
    for(i = 0; i < data.length; i++) {
        dat = data[i]
        insert_query = `
            INSERT INTO orders (bank_id, currency_id, interest_rate_online, interest_rate, min_time, max_time)
            VALUES (${dat.bank_id}, ${dat.currency_id}, ${dat.interest_rate_online}, ${dat.interest_rate}, ${dat.min_time}, ${dat.max_time});
            `
        await client.query(insert_query)
    }
}


async function insertBancoEstado(client, data) {
    // Insert Banco Estado Data
    //bank_q = "SELECT bank_id FROM banks WHERE bank_name = 'Banco Estado';"
    bank_id = 1
    //currency_q = "SELECT currency_id FROM currencies WHERE currency_name = 'CLP';"
    currency_id = 1
    // Delete previous orders from this bank
    await client.query('DELETE FROM orders WHERE bank_id=1')
    for (let i = 0; i < data.length; i++) {
        row = data[i]
        if (typeof row !== 'undefined' && row.length > 0) {
            interest_rate = row[1].slice(2, 4)
            interest_rate_online = row[2].slice(2, 4)
            time = row[0].slice(9)
            if (time.includes(' a ')) {
                min_time_end_pos = time.indexOf('a')
                min_time = time.slice(0, min_time_end_pos - 1)
                time = time.slice(min_time_end_pos + 2)
                max_time_end_pos = time.indexOf(' ')
                max_time = time.slice(0, max_time_end_pos)
            } else {
                min_time_end_pos = time.indexOf('d')
                min_time = time.slice(0, min_time_end_pos - 1)
                max_time = min_time
            }
            insert_query = `
            INSERT INTO orders (bank_id, currency_id, interest_rate_online, interest_rate, min_time, max_time)
            VALUES (${bank_id}, ${currency_id}, ${interest_rate_online}, ${interest_rate}, ${min_time}, ${max_time});
            `
            await client.query(insert_query)
        }
    }
}


async function crawlBancoEstado(browser) {
    // We open a tab on our given browser.
    let page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36');
    // and tell it to go to some URL
    url = 'https://www.bancoestado.cl/bancoestado/simulaciones/depositoplazo/DepPlazoTasas.asp'
    await page.goto(url, {
        waitUntil: 'domcontentloaded',
    })
    await page.waitForSelector('table[id=tasa-dep-plazo-pesos]')
    const result = await page.$$eval('#tasa-dep-plazo-pesos tr', rows => {
        return Array.from(rows, row => {
            const columns = row.querySelectorAll('td');
            return Array.from(columns, column => column.innerText);
        })
    })
    await page.close()
    return result
}


async function crawlBancoConsorcio(browser) {
    let page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36');
    url = "https://www.ccbolsa.cl/apps/script/modulos/DepositosPlazo/simulacion.asp"
    await page.goto(url, {
        waitUntil: 'domcontentloaded',
    })
    await page.waitForSelector('div.nice-select')
    await new Promise(resolve => setTimeout(resolve, 100))
    const data = []
    let dat;
    let lists = await page.$$('div.nice-select')
    const interest_rate_div = await page.$$('div.valores')
    const interest_rate_list = await interest_rate_div[2].$('ul')

    // Select deposit type
    await lists[3].click()
    let list = await lists[3].$('ul.list')
    let option = await list.$('li[data-value="1"]')
    await option.click()
    await new Promise(resolve => setTimeout(resolve, 100))


    // Select currency
    lists = await page.$$('div.nice-select')
    await lists[4].click()
    list = await lists[4].$('ul.list')
    option = await list.$('li[data-value="1"]')
    await option.click()
    await new Promise(resolve => setTimeout(resolve, 1000))


    // Select time
    lists = await page.$$('div.nice-select')
    await lists[5].click()
    list = await lists[5].$('ul.list')
    options = await list.$$('li')
    times = ['0', '7', '30', '60', '90', '180']
    let op
    for(i = 1; i < options.length - 1; i++) {
        op = options[i]
        await op.click()
        await new Promise(resolve => setTimeout(resolve, 1000))
        interest_rate_elem_text = await interest_rate_list.$eval('li#oTasaBaseMensual', el => el.innerText)
        dat = {
            bank_id: "2",
            currency_id: "1",
            min_time: times[i],
            max_time: times[i],
            interest_rate: interest_rate_elem_text.slice(2, -2),
            interest_rate_online: interest_rate_elem_text.slice(2, -2),
        }
        data.push(dat)
        await lists[5].click()
    }

    await page.close()

    return data
}


async function run(){
    // Connect to DB
    var client;
    if (typeof client == 'undefined') {
        client = new Client({
            connectionString: process.env.DATABASE_URL,
            ssl: {
                rejectUnauthorized: false
            }
        })
        // client = await new Client({
        //     user: 'postgres',
        //     host: 'localhost',
        //     database: 'GPTI',
        //     password: '45thelentia',
        //     port: 5432,
        // })
    }
    // We are going to share a browser instance between crawls
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox','--disable-setuid-sandbox'],
    })
    await client.connect()
    data = await crawlBancoEstado(browser)
    await insertBancoEstado(client, data)
    data = await crawlBancoConsorcio(browser)
    await insertBancoConsorcio(client, data)
    await browser.close()

    // close database connection
    await client.end()
}

run()