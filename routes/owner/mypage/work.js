const { Router } = require('express');
const workRouter = Router();
const mysql = require('mysql2/promise');

const pool = require('../../../util/function');
const getStore = require('../../../util/getStore');
const masageDate = require('../../../util/masageDate');

/* 사장님 홈 - 모집내역 */
/* input { 'owner_id': 2 } */

workRouter.post('/', async (req, res, next) => {
    const con = await pool.getConnection(async (conn) => conn);
    
    try{
        /* 1. owners 테이블에서 owner_id로 FK_orders_stores 가져오기 */
        const store_id = await getStore.getStoreIdByOwnerId(req.body['owner_id']);
        
        /* 2. order 테이블에서 store_id로 order_id 배열에 담기 */
        const sql = `SELECT order_id FROM orders WHERE FK_orders_stores=${store_id} AND (status=0 OR status=1)`;
        const [result] = await con.query(sql);
        if (result.length === 0) {
            return;
        }
    
        let order_ids = Array();
        for (let i = 0; i < result.length; i++) order_ids.push(result[i]['order_id']);
        req.body['order_ids'] = order_ids;
        // console.log(req.body);
        con.release();
        next();
    }
    catch{
        con.release();
        res.send('error');
    }
});

/* 3. hourly_orders 테이블에서 order_id에 해당하는 모든 row 가져오기 */
// orders, workers, jobs 테이블에서 필요한 정보만 추가로 JOIN
workRouter.use('/', async (req, res, next) => {
    const con = await pool.getConnection(async (conn) => conn);
    try{
        const sql = `SELECT A.*, B.order_id, B.min_price AS price, C.name, D.type FROM hourly_orders A 
                     INNER JOIN orders B ON A.FK_hourlyorders_orders = B.order_id
                     LEFT OUTER JOIN workers C ON A.FK_hourlyorders_workers = C.worker_id
                     INNER JOIN jobs D ON B.FK_orders_jobs = D.job_id
                     WHERE FK_hourlyorders_orders IN (${req.body['order_ids']})`;
        const [result] = await con.query(sql);
        req.body['hourly_orders'] = result;
        // console.log(result.length);
        con.release();
        next();
    }
    catch{
        con.release();
        res.send('error');
    }
});

/* 4. masage data */
workRouter.use('/', async (req, res, next) => {
    let send_data = new Array();

    try{
        let len = req.body['hourly_orders'].length;
        let tmp;
        let date;
        let type;
        let order_id;
        let check = {};
        let idx = 0;
        for (let i = 0; i < len; i++) {
            let key = new Array();
            tmp = req.body['hourly_orders'][i];
            await key.push(masageDate.masageDateToYearMonthDay(tmp['work_date']));
            key.push(tmp['type']);
            key.push(tmp['order_id']);
            key.push(tmp['checkin_flag']);
            key.push(tmp['status']);
    
            /* 이미 저장된 key인지 확인 */
            if (!check.hasOwnProperty(key)) {
                send_data.push(key);
                check[Object.assign(new Array(), key)] = idx;
                idx += 1;
            }
    
            await send_data[check[key]].push(
                masageDate.masageDateToHour(tmp['start_time']) + ',' + tmp['price'].toString() + ',' + tmp['name'] + ',' + tmp['hourlyorders_id']
            );
        }


        send_data.sort(function(a, b) {
            var date_A = new Date(a[0]);
            var date_B = new Date(b[0]);

            if (date_A < date_B) return -1;
            if (date_A > date_B) return 1;
            return 0;
        })
        // console.log(send_data);        
        res.send(send_data);
    }
    catch{
        res.send('error');
    }
});

module.exports = workRouter;

/************************ function *************************/

// /* owner_id로 stores 테이블에서 store id 가져오기 */
// async function getStoreIdByOwnerId(req, res, next) {
//     console.log(req.body);
//     const con = await pool.getConnection(async (conn) => conn);

//     try {
//         const sql = 'SELECT store_id FROM stores WHERE FK_stores_owners=?';
//         const [result] = await con.query(sql, req.body['owner_id']);
//         req.body['store_id'] = result[0]['store_id'];
//         next();
//     } catch {
//         console.log('error');
//         res.send('error');
//     }
// }

// /* '2022-08-20 00:00:000Z' 형식의 input을 '0000-00-00'형식으로 변환하여 리턴 */
// function masageDateToYearMonthDay(date_timestamp) {
//     let date = new Date(date_timestamp);
//     let year = date.getFullYear().toString();
//     let month = (date.getMonth() + 1).toString();
//     let day = date.getDate().toString();

//     if (month.length === 1) month = '0' + month;
//     if (day.length === 1) day = '0' + day;

//     return year + '-' + month + '-' + day;
// }

// /* '0000:00:00 ??:00:00.000Z' 형식을 받아서 '??:00' return */
// function masageDateToHour(timestamp) {
//     timestamp = new Date(timestamp);
//     let hour = timestamp.getHours().toString();
//     if (hour.length === 1) hour = '0' + hour;

//     return hour + ':00';
// }
