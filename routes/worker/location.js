const { Router } = require('express');
const locationRouter = Router();
const pool = require('../../util/function');

const nodeGeocoder = require('node-geocoder');
const getDist = require('../../util/getDist');

/* 구글 map api */
const options = {
    provider: 'google',
    apiKey: 'AIzaSyAHZxHAkDSHoI-lJDCg5YfO7bLCFiRBpaU' // 요놈 넣어만 주면 될듯?
  };
const geocoder = nodeGeocoder(options);




/* worker의 location 정보 send */
locationRouter.post('/', async (req, res) => {
  const con = await pool.getConnection(async conn => conn);
  const sql = "SELECT `location` FROM workers WHERE email=?";
  try {
    const [result] = await con.query(sql, req.body['email']);
    con.release();
    res.send(result[0]['location']); 
  } catch {
    con.release();
    res.send('error');
  }
});



/* 주소 정보 전달 받아서 worker table update
  data form === 
  {
    'email': 'dngp93@gmail.com', 
    'location': '서울시 관악구 성현동'
  } */
  locationRouter.post('/update', async (req, res) => {
    const con = await pool.getConnection(async conn => conn);
    try {
      const location = await getDist.getPos(req.body['location']);
      // location => [latitude, longitude];
      req.body['latitude'] = location[0];
      req.body['longitude'] = location[1];
      const sql = "UPDATE workers SET location=?, latitude=?, longitude=? WHERE email=?";
      await con.query(sql, [req.body['location'], req.body['latitude'], req.body['longitude'], req.body['email']])
      con.release();
      res.send('success');
    } catch {
      con.release();
      res.send('error');
    }
  })


// /* 주소 정보 전달 받아서 worker table update
//     data form === 
//     {
//         'email': 'dngp93@gmail.com', 
//         'location': '서울시 관악구 성현동'
//     } */
// locationRouter.post('/update', getPos, async (req, res, next) => {
//     const con = await pool.getConnection(async conn => conn);
//     try{        
//         const sql = "UPDATE workers SET location=?, latitude=?, longitude=? WHERE email=?";
//         const [result] = await con.query(sql, [req.body['location'], req.body['latitude'], req.body['longitude'], req.body['email']])
//         console.log('end of post');
//         con.release();
//         next();
//         // res.send('success');
//     }
//     catch{
//       con.release();
//       res.send('error - update workers');        
//     }
// })
// locationRouter.use('/update', async (req, res) => {
//     console.log(req.body)
//     const con = await pool.getConnection(async conn => conn);
//     console.log('start use');
//     let msg = "";
//     // console.log('msg?');
//     try{
//         // console.log('try?');
//         msg = "select worker_id";
//         // console.log('msg?');
//         const sql = `SELECT worker_id from workers where email='${req.body['email']}';`;
//         const [result] = await con.query(sql);
//         console.log('result:',result);
  
//         msg = 'create store_list';
//         const sql_store_list = `CREATE OR REPLACE VIEW ${result[0]['worker_id']}_store_list AS 
//         select store_id as list_id, name, minimum_wage, get_distance(latitude, ${req.body['latitude']}, longitude-${req.body['longitude']}) AS distance
//         from stores;`;
//         const [result_store_list] = await con.query(sql_store_list);
//         console.log('1. ',result_store_list);
        
//         msg = 'create store_qualified';
//         const sql_store_qualified = `create or replace view ${result[0]['worker_id']}_store_qualified as
//         select a.store_id, a.name, a.description, a.logo, a.background, a.address, b.name owner_name, b.phone
//         from stores a, owners b, ${result[0]['worker_id']}_store_list c
//         where c.distance < 1000 and a.name = c.name and a.FK_stores_owners = b.owner_id 
//         and a.store_id in (select FK_qualifications_stores from qualifications where FK_qualifications_workers = ${result[0]['worker_id']}); `;
//         const [result_store_qualified] = await con.query(sql_store_qualified);        
//         console.log('2. ',result_store_qualified[0]);
        
//         msg = 'create store_unqualified';
//         const sql_store_unqualified = `create or replace view ${result[0]['worker_id']}_store_unqualified as
//         select a.store_id, a.name, a.description, a.logo, a.background, a.address, b.name owner_name, b.phone
//         from stores a, owners b, ${result[0]['worker_id']}_store_list c
//         where c.distance < 1000 and a.name = c.name and a.FK_stores_owners = b.owner_id 
//         and a.store_id not in (select FK_qualifications_stores from qualifications where FK_qualifications_workers = ${result[0]['worker_id']}); `;
//         const [result_store_unqualified] = await con.query(sql_store_unqualified);        
//         console.log('3. ', result_store_unqualified[0]);      
        
//         msg = 'create order_list';
//           const sql_order_list = `create or replace view ${result[0]['worker_id']}_order_list as
//           select c.name, a.order_id, a.min_price, 
//           b.hourlyorders_id, b.work_date, b.start_time, b.dynamic_price, d.type
//           from orders a 
//           join hourly_orders b on a.order_id = b.FK_hourlyorders_orders
//           join ${result[0]['worker_id']}_store_qualified c on a.FK_orders_stores = c.store_id
//           join jobs d on a.FK_orders_jobs = d.job_id
//           where b.FK_hourlyorders_workers = Null; `;
//         const [result_order_list] = await con.query(sql_order_list);
//         console.log('4. ',result_order_list[0]);
  
//         con.release();
//         res.send('success');
//     }
//     catch{
//       con.release();
//       console.log('catch');
//       res.send(`error - ${msg}`);
//     }
//   });



module.exports = locationRouter;

/************************ function *************************/

// /* 두 좌표 간 거리 구하기 */
// async function getPos(req, res, next) {
//   const regionLatLongResult = await geocoder.geocode(req.body['location']);
//   const Lat = regionLatLongResult[0].latitude; //위도
//   const Long =  regionLatLongResult[0].longitude; //경도
//   req.body['latitude'] = Lat;
//   req.body['longitude'] = Long;
//   next();
// }