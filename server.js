const express = require('express');
const bodyParser = require('body-parser');
const Logger = require('./Logger');
const mysql = require('mysql');
const util = require('util');

const app = express();
const urlencodedParser = bodyParser.urlencoded({extended: false});
let dbConnect = false;

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'classroom'
});

const query = util.promisify(connection.query).bind(connection);
 
connection.connect((err) => {
    if (err) {
        dbConnect = false;
        return Logger.error('MySQL error connecting: ' + err.stack);
    }

    dbConnect = true;
    Logger.info('MySQL connected successfuly.');
});

/*
connection.end(() => {
    dbConnect = false;
    Logger.warn('MySQL closed connection.');
});
*/
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.use('/assets', express.static('assets'));

app.post('/', urlencodedParser, async(req, res) => {
    if (!req.body || !dbConnect) return res.sendStatus(400);

    let begDate = req.body.beginDate;
    let endDate = req.body.endDate;
    let stud = parseInt(req.body.sel_st)
    let arrUpdSts = req.body.dates_for_update_statuses;
    let hookiesbyday = [];
    let hookies = [];
    let id_group = 1;

    if (req.body['attendance_select_for_period'] && begDate && endDate) {
        hookies = await query('call attendance_select_for_period(?, ?, ?)', [id_group, begDate, endDate]);
        hookies = hookies[0];
    }

    if (stud && arrUpdSts && req.body['attendance_update_statuses']) {
        if (Array.isArray(arrUpdSts)) {
            for (const item of arrUpdSts) {
                await query('call attendance_update_statuses(?, ?, ?)', [stud, item, 2]);
            }
        } else await query('call attendance_update_statuses(?, ?, ?)', [stud, arrUpdSts, 2]);
    }

    if (stud && begDate && endDate && (req.body['attendance_select_for_period_by_day'] || req.body['attendance_update_statuses'] || req.body['attendance_select_for_period'])) {
        hookiesbyday = await query('call attendance_select_for_period_by_day(?, ?, ?, ?)', [stud, id_group, begDate, endDate]);
        hookiesbyday = hookiesbyday[0];

        for (const item in hookiesbyday) {
            hookiesbyday[item]['dateOfLesson'] = hookiesbyday[item]['dateOfLesson'].toMysqlFormat();
        }
    }

    let students = await query('call student_select_for_raport(?)', [id_group]);
    students = students[0];

    res.render('hooky', {
        'hookies': hookies,
        'students': students,
        'beginDate': begDate,
        'endDate': endDate,
        'sel_st': stud,
        'hookiesbyday': hookiesbyday
    });
});

app.get('/', async(req, res) => {
    if (!dbConnect) return res.sendStatus(400);
    const students = await query('call student_select_for_raport(?)', [1]);

    res.render('hooky', {
        'hookies': [],
        'students': students[0],
        'beginDate': '',
        'endDate': '',
        'sel_st': '',
        'hookiesbyday': []
    });
});

app.use((req, res, next) => {
    res.render('404');
});

app.listen(81);

function Commands() {
    this.list = {}; // Empty
}

module.exports = Commands;

// Commands
Commands.list = {
    clear: () => {
        process.stdout.write("\u001b[2J\u001b[0;0H");
    },
    exit: () => {
        Logger.warn("Closing server...");
        process.exit(1);
    },
    restart: () => {
        Logger.warn("Restarting server...");
        process.exit(3);
    },
    r: () => {
        Commands.list.restart();
    }
};

function twoDigits(d) {
    if(0 <= d && d < 10) return "0" + d.toString();
    if(-10 < d && d < 0) return "-0" + (-1*d).toString();
    return d.toString();
}


Date.prototype.toMysqlFormat = function() {
    return this.getUTCFullYear() + "-" + twoDigits(1 + this.getUTCMonth()) + "-" + twoDigits(this.getUTCDate() + 1);// + " " + twoDigits(this.getUTCHours()) + ":" + twoDigits(this.getUTCMinutes()) + ":" + twoDigits(this.getUTCSeconds());
};
