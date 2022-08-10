const { Router } = require('express');
const interviewRouter = Router();
const mysql = require('mysql2/promise');

const pool = require('../../util/function');

interviewRouter.post('/', async (req, res) => {
    //console.log(req.body);
    const con = await pool.getConnection(async (conn) => conn);

    try{
        const owner_id = req.body['owner_id'];
        cards = {};
        // console.log(owner_id);
        const sql_store = `select store_id from stores where FK_stores_owners = ${owner_id};`;
        const [result_store] = await con.query(sql_store);
        const store_id = result_store[0]['store_id'];
        // console.log(store_id);
    
        const sql = `select a.interview_id, a.interview_date, c.time, b.name, a.question, 
        a.state, a.cancel_flag, a.link 
        from interviews a 
        join workers b on a.FK_interviews_workers = b.worker_id 
        join interview_times c on a.FK_interviews_interview_times = c.interview_time_id
        where a.FK_interviews_stores = ${store_id} and a.reject_flag=0 and a.state > 0
        order by state, interview_date, time;`;
        const [result] = await con.query(sql);
        n = result.length;
        pre_state = 0;
        // console.log('>>>>>', result, '<<<<<');
    
        const sql_owner = `SELECT name FROM owners WHERE owner_id = ${owner_id};`;
        const [result_owner] = await con.query(sql_owner);
        // console.log(result_owner);
        const owner_name = result_owner[0]['name'];
    
        const step = { 1: 'now', 2: 'wait', 3: 'will', 4: 'complete', 6: 'expired' };
    
        for (let i = 0; i < n; i++) {
            worker_id = result[i]['FK_interviews_workers'];
    
            date = result[i]['interview_date'].toISOString();
            interview_date = date.split('T')[0];
            interview_time = result[i]['time'];
            interview_id = result[i]['interview_id'];
            // cancel_flag = result[i]['cancel_flag'];
            // link = result[i]['link'];
            state = result[i]['state'];
            question = result[i]['question'];
            worker_name = result[i]['name'];
    
            card = {
                interview_id: interview_id,
                interview_date: interview_date,
                interview_time: interview_time,
                // 'cancel_flag': cancel_flag,
                // 'link': link,
                state: state,
                worker_name: worker_name,
                question: question,
            };
    
            if (pre_state == state) {
                if (cards[step[state]]) cards[step[state]].push(card);
                else cards[step[state]] = [card];
            } else {
                cards[step[state]] = [card];
                pre_state = state;
            }
        }
    
        // res.send(dummy)
        console.log('cards: ',cards); 
        con.release();
        res.send(cards);
    }
    catch{
        con.release();
        res.send('error');
    }
});

module.exports = interviewRouter;

/************************ function *************************/
