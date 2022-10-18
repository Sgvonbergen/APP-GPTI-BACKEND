// import puppeteer library
const puppeteer = require('puppeteer')
const { Client } = require('pg');


async function insertBancoConsorcio(client, data) {
    let a = 1
}


async function insertBancoEstado(client, data) {
    // Insert Banco Estado Data
    bank_q = "SELECT bank_id FROM banks WHERE bank_name = 'Banco Estado';"
    bank_id = await (await client.query(bank_q)).rows[0].bank_id
    currency_q = "SELECT currency_id FROM currencies WHERE currency_name = 'CLP';"
    currency_id = await (await client.query(currency_q)).rows[0].currency_id
    // Delete previous orders from this bank
    await client.query(`DELETE FROM orders WHERE bank_id = ${bank_id}`)
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
    await browser.close()
    return result
}


async function crawlBancoConsorcio(browser) {
    let page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36');
    url = "https://www.ccbolsa.cl/apps/script/modulos/DepositosPlazo/simulacion.asp"
    await page.goto(url, {
        waitUntil: 'domcontentloaded',
    })
    await page.waitForSelector('ul[class=list]')
    const dropdowns = await page.$$('ul[class=list]');
    const typelist = await dropdowns[3].getProperty('parentNode')
    await typelist.click()
    let lis = await dropdowns[3].getProperty('childNode')
    console.log(await (await lis.getProperty('className')).toString())
    console.log(await (await typelist.getProperty('className')).toString())


    await page.close()
    await browser.close()
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
    // data = await crawlBancoConsorcio(browser)
    // await insertBancoConsorcio(data, client)

    // close database connection
    await client.end()
}

run()