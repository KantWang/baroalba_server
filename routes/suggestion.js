const { Router } = require('express');
const suggestionRouter = Router();
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: "albadb.cpew3pq0biup.ap-northeast-2.rds.amazonaws.com",
  user: "admin",
  password: "dnjstnddlek",
  database: "gig_time",
  connectionLimit: 10
});


/* 최적의 알바 추천 */
/* 
  data form
  {
    'worker_id': 1,
    'work_date': '2022-08-20',
    'start_times': 
      [
        "2022-08-20 10:00:00", 
        "2022-08-20 11:00:00",
        "2022-08-20 12:00:00"
      ]
  }
*/
suggestionRouter.post('/', async (req, res) => {
    const con = await pool.getConnection(async conn => conn);
    /* 
      hourly_orders 테이블고 orders 테이블을 JOIN 한 후, 
      work_date와 worker_id, start_time 그리고 worker가 권한을 가지고 있는 store로 필터하여 SELECT
    */
    const sql = `SELECT * FROM hourly_orders A 
                  INNER JOIN orders B ON A.FK_hourlyorders_orders = B.order_id
                  INNER JOIN stores C ON B.FK_orders_stores = C.store_id
                  WHERE A.FK_hourlyorders_workers IS Null AND A.work_date=? AND A.start_time IN (?) 
                  AND B.FK_orders_stores IN
                  (SELECT store_id FROM stores WHERE store_id IN 
                    (SELECT FK_qualifications_stores FROM qualifications 
                      WHERE FK_qualifications_workers=?))`;
    const [result] = await con.query(sql, [req.body['work_date'], req.body['start_times'], req.body['worker_id']]);
      // console.log('모든 개수: ' + result.length);
    suggestion(req.body['worker_id'], result, req.body['start_times']);
  })
  
module.exports = suggestionRouter;

/************************ function *************************/

/* bruteforce 방식의 suggestion 함수 */
/* 이때, 거리 상관 없이 모든 hourly_order가 들어온다 */
async function suggestion(worker_id, hourly_orders, start_times)
{
    const con = await pool.getConnection(async conn => conn);
    const sql = "SELECT `range`, `latitude`, `longitude` FROM workers WHERE worker_id=?"
    const [result] = await con.query(sql, worker_id); 
    let range = result[0]['range'];
    let latitude = result[0]['latitude'];
    let longitude = result[0]['longitude'];
    let times_count = start_times.length;
        
    /* 우선, range 이내의 hourly_order를 가져오자. */
    let hourly_orders_sliced = getInnerRange(latitude, longitude, range, hourly_orders);
    // console.log('총 개수: ' + hourly_orders_sliced.length);
    // console.log(hourly_orders_sliced);

    /* 이제 들어온 시간 별로 나눠야 한다. */
    let hourly_orders_divided_by_start_time = {};
    for (let i = 0; i < times_count; i++) 
    {
        let tmp = new Date(start_times[i]);
        hourly_orders_divided_by_start_time[tmp] = Array();
    }
    // console.log(hourly_orders_divided_by_start_time);

    /* 각 시간에 해당하는 hourorders_id를 모두 push. min_price와 함께 */
    /* 여기서 idx와 id의 연결 관계를 만들어주자 */
    let id_idx = {};
    for (let i = 0; i < hourly_orders_sliced.length; i++)
    {
        let tmp = new Date(hourly_orders_sliced[i]['start_time']);
        hourly_orders_divided_by_start_time[tmp].push({
        'idx': i,
        'id': hourly_orders_sliced[i]['hourlyorders_id'],
        'price': hourly_orders_sliced[i]['min_price']
        });
        id_idx[hourly_orders_sliced[i]['hourlyorders_id']] = i;
    }
    
    /* 이제 각 시간별로 min_price 순으로 정렬하자, 앞에 올수록 가격이 높아지도록 */
    // 참고로, hourly_orders_sliced 이 안에 다 있다.
    for (let i = 0; i < times_count; i++) {
        let tmp = new Date(start_times[i]);
        hourly_orders_divided_by_start_time[tmp].sort(function(a, b) {
        var price_A = a.price;
        var price_B = b.price;

        if (price_A < price_B) return 1;
        if (price_A > price_B) return -1;
        return 0;
        })
    }

    /* 재귀 방식 - dp 코드 추가 전이라 안돌아감 */
    // let max = recur(0, start_times, latitude, longitude, hourly_orders_divided_by_start_time, hourly_orders_sliced, 0);

    /* 완성된 방식 - 브루트포스 + dp */
    let queue = Array(); // [depth, latitude, longitude, revenue, visit, total_move]
    let key = new Date(start_times[0]);
    for (let i = 0; i < hourly_orders_divided_by_start_time[key].length; i++) {
        let short = hourly_orders_divided_by_start_time[key][i];
        let move_first = getDistance(latitude, 
                                    longitude, 
                                    hourly_orders_sliced[short['idx']]['latitude'],
                                    hourly_orders_sliced[short['idx']]['longitude']);
        queue.push([1, 
                    hourly_orders_sliced[short['idx']]['latitude'],
                    hourly_orders_sliced[short['idx']]['longitude'],
                    short['price'] - move_first * 2.5,
                    [short['id']],
                    move_first]); // 비트마스킹으로 하자
    }
        
    let answer = 0;
    let answer_move = 0;
    let answer_visit = [];
    let dp = {};

    /* 터미널에 보기 좋게 출력 */
    console.log();
    console.log("**************************************")
    console.log("*                                    *")
    console.log("*            알바시간표추천          *")
    console.log("*                                    *")
    console.log('*          근로일시: 2022-08-20      *');
    console.log('*          모집시간: ' + start_times.length + '시간          *');
    console.log("*                                    *")
    console.log("**************************************")
    console.log()
    console.log();
    console.log('------------- 추천 시작 -------------')
    while (queue.length > 0) 
    {
        let now = queue.shift(); // popleft
        let depth = now[0];
        let latitude = now[1];
        let longitude = now[2];
        let revenue = now[3];
        let visit = Object.assign(Array(), now[4]);
        // visit.push(now[4]);
        let total_move = now[5];
        
        /* 탈출 조건 */
        if (depth === times_count)
        {
        if (answer < revenue) {
            let before = answer;
            answer = revenue;
            answer_move = total_move;
            answer_visit = Object.assign(Array(), visit);
            if (before > 0)
            console.log('   ' + answer + '원     -->     ' + (answer-before) + '원 증가!');
            else
            console.log('   ' + answer + '원');
        }
        continue;
        }

        let key = new Date(start_times[depth]);
        let len = hourly_orders_divided_by_start_time[key].length;

        for (let i = 0; i < len; i++) {
        let short = hourly_orders_divided_by_start_time[key][i];
        let next_latitude = hourly_orders_sliced[short['idx']]['latitude'];
        let next_longitude = hourly_orders_sliced[short['idx']]['longitude'];
        let next_visit = Object.assign(Array(), visit);
        /* 거리를 계산하자 */
        let move = getDistance(latitude, 
                                longitude,
                                next_latitude,
                                next_longitude);
        
        /* 다음 revenue를 계산하자 */
        let next_revenue = revenue + short['price'] - move * 2.5;

        /* dp 값 업데이트 및 continue 처리 */
        if (!dp.hasOwnProperty([depth, i]))
            dp[[depth, i]] = next_revenue;
        else
        {
            if (dp[[depth, i]] > next_revenue) continue;
            else dp[[depth, i]] = next_revenue;
        }

        /* visit 처리 */
        next_visit.push(short['id']);
        
        /* queue에 삽입 */ 
        // [depth, latitude, longitude, revenue, visit]
        queue.push([depth+1, 
                    next_latitude,
                    next_longitude,
                    next_revenue,
                    next_visit,
                    total_move+move]);
        
        }
    }
    console.log();
    console.log('------------- 추천 결과 -------------')
    console.log('1. 최고수익: ' + answer + '원');
    console.log('2. 이동거리: ' + answer_move + 'm');
    console.log('3. 방문순서');

  
    for (let i = 0; i < answer_visit.length; i++)
    {
        let idx = id_idx[answer_visit[i]];
        console.log('   ' + start_times[i] + ' -- ' + hourly_orders_sliced[idx]['name']);
    }
}

/* 두 개의 좌표 간 거리 구하기 */
function getDistance(lat1, lon1, lat2, lon2) {
    if ((lat1 == lat2) && (lon1 == lon2)) return 0;
  
    let radLat1 = Math.PI * lat1 / 180;
    let radLat2 = Math.PI * lat2 / 180;
  
    let theta = lon1 - lon2;
    let radTheta = Math.PI * theta / 180;
    let dist = Math.sin(radLat1) * Math.sin(radLat2) + Math.cos(radLat1) * Math.cos(radLat2) * Math.cos(radTheta);
  
    if (dist > 1) dist = 1;
    
    dist = Math.acos(dist);
    dist = dist * 180 / Math.PI;
    dist = dist * 60 * 1.1515 * 1.609344 * 1000;
  
    if (dist < 100) dist = Math.round(dist / 10) * 10;
    else dist = Math.round(dist / 100) * 100;
    
    return dist;
}


/* 현재위치에서 range 이내인 info 원소만 뽑아서 return */
function getInnerRange(latitude, longitude, range, info) {
    const n = info.length;
    let answer = new Array();
    let tmp = 0;
  
    /* 이렇게 짜면 너무 너무 비효율적이다 */
    /* db 구조를 바꿔야 하나? 아니면, 탐색 방식을 개선? */
    for (let i = 0; i < n; i++) {
        tmp = getDistance(latitude, longitude, info[i]['latitude'], info[i]['longitude']);
        if (tmp <= range) {
            answer.push(info[i]);
        }
    }
  
    return answer;
  }