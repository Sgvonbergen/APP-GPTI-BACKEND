var express = require('express');
var router = express.Router();
const { Client } = require('pg')


/* GET home page. */
router.get('/', function(req, res, next) {
    res.render('index', { title: 'Express' });
});

/* GET JSON of available deposit options */
router.get('/depositos', async function(req, res, next) {
    var client
    if (typeof client === 'undefined') {
        client = await new Client({
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
