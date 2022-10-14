var express = require('express');
var router = express.Router();
const { Client } = require('pg')

// const client = new Client({
//     host: 'localhost',
//     user: 'postgres',
//     database: 'GPTI',
//     password: '45thelentia',
//     port: 5432,
// })

function connectToClient() {
    console.log(typeof client)
    if (typeof client == 'undefined') {
        const client = new Client({
            connectionString: process.env.DATABASE_URL,
            ssl: {
                rejectUnauthorized: false
            }
        })
    }
    client.connect()
}


/* GET home page. */
router.get('/', function(req, res, next) {
    res.render('index', { title: 'Express' });
});

/* GET JSON of available deposit options */
router.get('/depositos', async function(req, res, next) {
    connectToClient()
    query = `SELECT * FROM orders AS o
        INNER JOIN currencies AS c
        ON o.currency_id = c.currency_id
        INNER JOIN banks AS b
        ON o.bank_id = b.bank_id;
    `
    const depositos = await client.query(query)
    res.json(depositos)
    await client.end()
})

module.exports = router;
