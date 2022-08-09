require('dotenv').config();
const Datastore = require('nedb');
const express = require('express');
const basicAuth = require("express-basic-auth")

const app = express();
app.use(express.json());

if(process.env.WEB_AUTH == "true"){
    const pass = process.env.WEB_PASS;

    app.use(basicAuth({
        users: { "hanako" : pass },
        challenge: true,
    }));

}

app.use(express.static('public'));

app.get('/se', (req, res) => {
    const db = new Datastore({ filename: `${ process.env.HANAKO_PATH }/db/soundeffect.db`, autoload: true });
    db.find({ id: process.env.DISCORD_SERVER_ID }, function (err, docs) {
        if (err) {
            res.sendStatus(500)  
        }
        res.send({ id: docs[0].id, dict: (docs[0].dict).sort() })
        
    });

});

app.listen(process.env.WEB_PORT, () => {
    console.log("listen");
});
