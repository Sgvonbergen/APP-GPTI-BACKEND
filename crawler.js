// import puppeteer library
const puppeteer = require('puppeteer')
const { Client } = require('pg');


async function run(){

    const client = new Client({
        user: 'dbuser',
        host: 'database.server.com',
        database: 'mydb',
        password: 'secretpassword',
        port: 3211,
    })
    client.connect()


    // First, we must launch a browser instance
    const browser = await puppeteer.launch({
        // Headless option allows us to disable visible GUI, so the browser runs in the "background"
        // for development lets keep this to true so we can see what's going on but in
        // on a server we must set this to true
        headless: false,
        // This setting allows us to scrape non-https websites easier
        ignoreHTTPSErrors: true,
    })
    // then we need to start a browser tab
    let page = await browser.newPage();
    // and tell it to go to some URL
    await page.goto('https://www.bancoestado.cl/bancoestado/simulaciones/depositoplazo/DepPlazoTasas.asp', {
        waitUntil: 'domcontentloaded',
    });
    await page.waitForSelector('table[id=tasa-dep-plazo-pesos]')

    // const result = await page.evaluate(() => {
    //     const rows = document.querySelectorAll('tbody tr td');
    //     console.log(rows)
    //     return Array.from(rows, row => {
    //         const columns = row.querySelectorAll('td');
    //         return Array.from(columns, column => column.innerText);
    //     });
    // });

    const result = await page.$$eval('#tasa-dep-plazo-pesos tr', rows => {
        return Array.from(rows, row => {
            const columns = row.querySelectorAll('td');
            return Array.from(columns, column => column.innerText);
        });
    });
    console.log(result)

    // close everything
    await page.close();
    await browser.close();
}

run();