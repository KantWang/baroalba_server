const express = require("express");
const app = express();
const mysql = require('mysql2/promise');
const pool = require('./util/function');
const schedule = require('node-schedule');

module.exports = {
    /* 매 정시마다 실행되며 orders 테이블 status 업데이트 */
    job: async function () { 
        schedule.scheduleJob('0 0 * * * *', async function() {
            const con = await pool.getConnection(async conn => conn);
            let now = new Date();
            now = masageDateToYearMonthDayHourMinSec(now)
            console.log('now: ',now)
        
            /* 1시간마다 변경해야 하는 것은 */
            // 1. hourly_orders 테이블의 status
            // - 0: 매칭 전, 1: 매칭 성공, 2: 매칭 실패 후 종료, 3: 매칭 성공 후 종료
            const sql = `SELECT hourlyorders_id, work_date, start_time, status, FK_hourlyorders_orders AS order_id
                         FROM hourly_orders
                         WHERE (status=0 || status=1) AND start_time<'${now}' ORDER BY work_date ASC`
            const [result] = await con.query(sql);
            console.log('마감 hourly_orders: ', result)
            
            
            // 완료처리하기
            const sql2 = `UPDATE hourly_orders SET status=? WHERE hourlyorders_id=?`
        
            let check_list_after_update = new Array();
            for (let i = 0; i < result.length; i++) {
                // 여기서 status 변경처리 하면됨
                if (result[i]['status'] === 0) {
                    await con.query(sql2, [2, result[i]['hourlyorders_id']])
                } else {
                    await con.query(sql2, [3, result[i]['hourlyorders_id']])
                }
                if (!check_list_after_update.includes(result[i]['order_id']))
                check_list_after_update.push(result[i]['order_id'])
            }
            console.log('점검 orders: ', check_list_after_update)
            for (let i = 0; i < check_list_after_update.length; i++) {
                await check_order_status(check_list_after_update[i])
            }
            con.release();
        })
    },
    /* 매 정시마다 실행되며 orders 테이블 status 업데이트 */
    interview: async function () { 
        schedule.scheduleJob('0 0 * * * *', async function() {
            const con = await pool.getConnection(async conn => conn);
            let now = new Date();
            now_date = now.toISOString().split('T')[0];
            now_hour = now.getHours().toString().split(':')[0];
            console.log('now: ',now_date, now_hour);
        
            /* 1시간마다 변경해야 하는 것은 */
            // 1. interviews 테이블의 status
            // - 0: 거절, 1: 입장대기, 2: 승인대기, 3: 면접대기, 4: 면접종료, 5: 결과확인, 6: 만료
            // - 1, 2, 3 인 채로 면접 일자가 지나버리면 만료(6)로 변경
            const sql = `SELECT interview_id, FK_interviews_workers, state
            FROM interviews a 
            join interview_times b on a.FK_interviews_interview_times = b.interview_time_id
            WHERE (state=1 || state=2 || state=3) AND ((a.interview_date = '${now_date}'  AND b.time<'${now_hour}') || a.interview_date<'${now_date}') ORDER BY interview_date ASC;`
            const [result] = await con.query(sql);
            console.log('만료 interview: ', result)
            
            
            // 만료처리하기
            const sql2 = `update interviews set state=6 where interview_id=?`
        
            let update_interviews = new Array();
            for (let i = 0; i < result.length; i++) {
                // 여기서 status 변경처리 하면됨
                await con.query(sql2, [result[i]['interview_id']]);
                update_interviews.push(result[i]['FK_interviews_workers']);
            }
            // 만료된거 푸시해줄수도
            con.release();
        })
    }
};


/* order의 모든 hourlyorder가 예약 된 경우, order의 status=1로 변경 */
async function check_order_status(order_id) {
    const con = await pool.getConnection(async conn => conn);
        
    /* order_id에 해당하는 order의 status 가져오기 */
    const [status] = await con.query(`SELECT status FROM orders WHERE order_id=${order_id} LIMIT 1`)
    console.log(status)
    /* order_id에 해당하는 hourly_order를 모두 SELECT (아직 예약되지 않은 것만) */ 
    const sql = `SELECT * FROM hourly_orders WHERE FK_hourlyorders_orders=? AND (status=0 || status=1)`
    const [result] = await con.query(sql, order_id); 
  
    /* 만약 SELECT 된 것이 없다면 (남은 것이 없다면) */
    if (result.length === 0) {
        /* orders table의 status 업데이트 */
        // - 0: 매칭 전, 1: 매칭 성공, 2: 매칭 실패 후 종료, 3: 매칭 성공 후 종료
        const sql2 = `UPDATE orders SET status=? WHERE order_id=?`;        
        if (status[0]['status'] === 0) // 매칭 실패라면
            await con.query(sql2, [2, order_id]);
        else // 매칭 성공이라면
            await con.query(sql2, [3, order_id])
        console.log(order_id,': status update complete!');
    } else {
        console.log(order_id,': status update fail!');
    }
    con.release();
};


function masageDateToYearMonthDayHourMinSec(date_timestamp) {
    let date = new Date(date_timestamp);
    let hour = date.getHours().toString();
    let min = date.getMinutes().toString();
    let sec = date.getSeconds().toString();
  
    if (hour.length === 1) hour = '0'+hour
    if (min.length === 1) min = '0'+min
    if (sec.length === 1) sec = '0'+sec
  
    return (masageDateToYearMonthDay(date_timestamp)+' '+hour+':'+min+':'+sec);
}

function masageDateToYearMonthDay(date_timestamp) {
    let date = new Date(date_timestamp);
    let year = date.getFullYear().toString();
    let month = (date.getMonth() + 1).toString();
    let day = date.getDate().toString();

    if (month.length === 1) month = '0'+month;
    if (day.length === 1) day = '0'+day;

    return (year+'-'+month+'-'+day);
}
