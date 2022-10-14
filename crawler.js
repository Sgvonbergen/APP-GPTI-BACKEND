// import puppeteer library
const puppeteer = require('puppeteer')
const { Client } = require('pg');


async function run(){

    // Banco Estado Crawl
    // First, we must launch a browser instance
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox','--disable-setuid-sandbox'],
    })
    // then we need to start a browser tab
    let page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36');
    // and tell it to go to some URL
    await page.goto('https://www.bancoestado.cl/bancoestado/simulaciones/depositoplazo/DepPlazoTasas.asp', {
        waitUntil: 'domcontentloaded',
    });
    await page.waitForSelector('table[id=tasa-dep-plazo-pesos]')

    const result = await page.$$eval('#tasa-dep-plazo-pesos tr', rows => {
        return Array.from(rows, row => {
            const columns = row.querySelectorAll('td');
            return Array.from(columns, column => column.innerText);
        });
    });
    await page.close();
    await browser.close();

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
    await client.connect()

    // Insert Banco Estado Data
    bank_q = "SELECT bank_id FROM banks WHERE bank_name = 'Banco Estado';"
    bank_id = await (await client.query(bank_q)).rows[0].bank_id
    currency_q = "SELECT currency_id FROM currencies WHERE currency_name = 'CLP';"
    currency_id = await (await client.query(currency_q)).rows[0].currency_id
    // Delete previous orders from this bank
    await client.query(`DELETE FROM orders WHERE bank_id = ${bank_id}`)

    for (let row in result) {
        console.log(row)
        if (row.length > 0) {
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
    console.log(await client.query("SELECT * FROM orders;"))
    // close everything
    await client.end();
}

run();