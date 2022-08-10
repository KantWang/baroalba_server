const { Router } = require("express");
const qrCodeRouter = Router();
const pool = require('../../util/function');
const push_noti = require("../push");

 
/* 사장님 사장님 최저시급 설정 페이지 */
/* owner db에 사장님 회원정보 INSERT & store db에 가게정보 INSERT */
/* 
data form
{
    'owner_id': 1,  // store : 1,  435 // order : 1
    'worker_id': 17,
    'time': '2022-08-01T10:00:00.233Z'
} 
*/
// // 이거 하기 전에 들어온 데이터가 정확한지 체크하는 과정이 필요
qrCodeRouter.post("/", async (req, res) => {
    console.log('req: ', req.body);
    const con = await pool.getConnection(async (conn) => conn);
    try {
        let success = '';
        /* 1. 들어온 시간부터 파싱해서 시간대 정하고 */
        let owner_id = req.body['owner_id'];
        let worker_id = req.body['worker_id'];
        let work_time = req.body['time'];
        console.log(owner_id, worker_id, work_time);
        let date = work_time.split('T')[0];
        let time = work_time.split('T')[1].split('.')[0];
        console.log(time);
        let minute = Number(time.slice(3, 5));
        console.log(minute);
        let hour = minute>30 ? Number(time.slice(0,2)) + 10 : Number(time.slice(0,2)) + 9;
        if (hour>=24){
            hour -= 24;
            // console.log('>>24<<', date);
            // console.log(date.slice(0, -2))
            // console.log(date.slice(-2))
            // console.log(Number(date.slice(-1,-3))+1)
            date = date.slice(0, -2) + String(Number(date.slice(-2))+1).padStart(2,0);
        }
        let start_time = date + " " + String(hour).padStart(2,0) + ":00:00";
        
        console.log(date)
        console.log(String(hour).padStart(2,0) + ":00:00")
        console.log('start_time: ', start_time);

        const sql_store = `select store_id from stores where FK_stores_owners = ${owner_id};`;
        const [store] = await con.query(sql_store);
        const store_id = store[0]['store_id'];

        console.log('store_id: ', store_id);
 
        /* 2. angels랑 hourly_orders에서 해당 가게의 해당 시간대에서 worker_id 검색*/
        const sql_hourly_orders = `select hourlyorders_id, FK_hourlyorders_workers from hourly_orders 
                                        where '${start_time}' = start_time and FK_hourlyorders_orders in (select order_id from orders where FK_orders_stores = ${store_id});`
        const [hourly_orders] = await con.query(sql_hourly_orders);
        const sql_angels = `select angel_id, FK_angels_workers from angels 
                                where '${start_time}' = start_time and FK_angels_stores = ${store_id};`;
        const [angels] = await con.query(sql_angels);

        console.log(hourly_orders);
        console.log(angels);
        /* 3. 있으면 업데이트하고 'success', 없으면 'notFound', 에러면 'error'반환 */
        const hourly_work = hourly_orders.filter((e)=> e['FK_hourlyorders_workers'] === Number(worker_id));
        const angels_work = angels.filter((e)=> e['FK_angels_workers'] === Number(worker_id));
        console.log(hourly_work);
        console.log(angels_work);
         
        if(hourly_work[0]){
            console.log('hourly', worker_id, hourly_work[0]['hourlyorders_id']);
            const sql_update_hourly = `update hourly_orders set checkin_flag = 1 
            where FK_hourlyorders_workers = ${worker_id} and hourlyorders_id = ${hourly_work[0]['hourlyorders_id']};`;
            await con.query(sql_update_hourly);
            success = 'success'
        }else if(angels_work[0]){
            console.log('angels');
            const sql_update_angel = `update angels set checkin_flag = 1 
            where angel_id = ${angels_work[0]['angel_id']} and FK_angels_workers = ${worker_id};`;
            await con.query(sql_update_angel);
            success = 'success'
        }else{
            console.log('not');
            success = 'notFound'
        }
        const sql_worker = `select name from workers where worker_id = ${worker_id};`;
        const [worker_info] = await con.query(sql_worker);
        
        /* success일 때 owner_id 찾아서 push */
        if (success==='success'){
            const sql_token = `select FK_permissions_owners, token from permissions 
                                where FK_permissions_owners = ${owner_id};`;
            const [token] = await con.query(sql_token);
    
            let push_token = token[0]["token"];
            console.log(push_token);
            let title = `출석체크`;
            let info = {
                worker_name: worker_info[0]['name'],
            };
    
            push_noti(push_token, title, info);
            console.log("출석완료");
        }

        let result = {
            success,
            name: worker_info[0]['name']
        }
        /* QR스캔 기기에서 보여주는 정보 */
        console.log(result);
        con.release();
        res.send(result);
    } 
    catch {
        console.log({success:"fail", name:""});
        con.release();
        res.send({success:"fail", name:""});//
    }
});

module.exports = qrCodeRouter;

/************************ function *************************/
