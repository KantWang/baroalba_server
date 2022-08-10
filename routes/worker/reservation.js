const { Router } = require('express');
const reservationRouter = Router();
const pool = require('../../util/function');
const masageDate = require('../../util/masageDate');


/* 알바 예약 페이지 */
/* 페이지 로딩 시 뿌려주는 데이터 */
/* 
{
  'order_id': 2, 
  'work_date': '2022-08-20 00:00:000Z', 
  'type': '설거지'
} */
reservationRouter.post('/list', async (req, res, next) => {
    console.log('reservation: ', req.body);
    const con = await pool.getConnection(async conn => conn);
    const sql = "SELECT job_id FROM jobs WHERE type=?"
    req.body['work_date'] = masageDate.masageDateToYearMonthDay(req.body['work_date']);
    try {
        const [result] = await con.query(sql, req.body['type'])
        req.body['job_id'] = result[0]['job_id'];
        con.release();
        next();
    } catch {
        con.release();
        res.send('error');
    }
})
  
reservationRouter.use('/list', async (req, res) => {
    const con = await pool.getConnection(async conn => conn);
    const sql = `SELECT hourlyorders_id, dynamic_price, min_price, start_time 
                 FROM hourly_orders A
                 INNER JOIN orders B ON A.FK_hourlyorders_orders = B.order_id
                 WHERE B.order_id=? AND A.work_date=? AND B.FK_orders_jobs=? AND A.status=0`;
    try{
        const [result] = await con.query(sql, [req.body['order_id'],req.body['work_date'],req.body['job_id']])
        console.log(result);
        con.release();
        res.send(result);
    } catch {
        con.release();
        res.send('error');
    }
})

  
/* 알바 예약 페이지 */
/* 예약하기 클릭 시 hourly_orders 테이블에 worker_id 기입, closing_time 기입 */
/* 한 order의 hourly_orders가 전부 예약 되었다면, order의 status=1로 UPDATE */ 
/* 
{
    'worker_id': 2, 
    'hourlyorders_id': [5, 6, 7, 8, 9]
} */

/* 신청한 시간에 예약 가능한지 먼저 체크 */
reservationRouter.post('/save', async (req, res, next) => {
    // hourlyorder에 해당하는 일시를 가져오고
    // 그 시간에 해당 worker의 예약 내역이 존재하는지 보면 된다
    const con = await pool.getConnection(async conn => conn);
    const sql = `SELECT hourlyorders_id, start_time
                  FROM hourly_orders
                  WHERE FK_hourlyorders_workers=${req.body['worker_id']} AND start_time IN (
                    SELECT start_time 
                    FROM hourly_orders 
                    WHERE hourlyorders_id IN (?)
                  ) LIMIT 1`
    
    try{
        const [result] = await con.query(sql, [req.body['hourlyorder_id']])
        console.log(result)
        con.release()
    
        if (result.length > 0) {
            res.send("Reservation failed");
            return;
        } else {
            console.log("Reservation is possible!")
            next();
        }    
    }
    catch{
        con.release();
        res.send('error');
    }
})

reservationRouter.use('/save', async (req, res) => {
    // console.log(req.body)
    const con = await pool.getConnection(async conn => conn);
    const sql = "UPDATE hourly_orders SET FK_hourlyorders_workers=?, closing_time=? WHERE hourlyorders_id=?";
    try{
        for (let i = 0; i < req.body['hourlyorder_id'].length; i++) {
            let tmp = new Date().getTime();
            let timestamp = new Date(tmp);
            /* check! 쿼리를 한 번만 실행해서 해당 column 모두 UPDATE 하는 방법은? */
            await con.query(sql, [req.body['worker_id'], timestamp, req.body['hourlyorder_id'][i]]); 
        }
        check_all_hourlyorders_true(req.body['hourlyorder_id'][0]);
        con.release();
        res.send('success');
    }
    catch{
        con.release();
        res.send('error');        
    }
})

module.exports = reservationRouter;

/************************ function *************************/


// /* '2022-08-20 00:00:000Z' 형식의 input을 '0000-00-00'형식으로 변환하여 리턴 */
// function masageDateToYearMonthDay(date_timestamp) {
//     let date = new Date(date_timestamp);
//     let year = date.getFullYear().toString();
//     let month = (date.getMonth() + 1).toString();
//     let day = date.getDate().toString();
    
//     if (month.length === 1) month = '0'+month;
//     if (day.length === 1) day = '0'+day;
    
//     return (year+'-'+month+'-'+day);
// }

  
/* order의 모든 hourlyorder가 예약 된 경우, order의 status=1로 변경 */
async function check_all_hourlyorders_true(hourlyorders_id) {
    console.log('start check!');
    const con = await pool.getConnection(async conn => conn);
  
    /* 우선 hourlyorders_id에 딸린 FK_hourlyorders_orders를 찾아옴 */
    const sql = `SELECT FK_hourlyorders_orders FROM hourly_orders WHERE hourlyorders_id=?`;
    const [result] = await con.query(sql, hourlyorders_id);
    let order_id = result[0]['FK_hourlyorders_orders'];
        
    /* 이제 order_id에 해당하는 hourly_order를 모두 SELECT (아직 예약되지 않은 것만) */ 
    const sql2 = `SELECT * FROM hourly_orders WHERE FK_hourlyorders_orders=? AND closing_time IS Null`
    const [result2] = await con.query(sql2, order_id); 
  
    /* 만약 SELECT 된 것이 없다면 (모두 예약된 상태라면) */
    if (result2.length === 0) 
    {
        /* orders table의 status=1로 업데이트 */
        const sql3 = `UPDATE orders SET status=1 WHERE order_id=?`;
        try {
            await con.query(sql3, order_id);
        } catch {
            console.log('error');
        }
    }
    con.release();
};