const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql2/promise");
const app = express();
const PORT = process.env.PORT || 4000;
const path = require('path');
const fs = require("fs");
const pool = require('./util/function');

/* console.log depth에 필요 */
let util = require("util");




/* 실행 시 특정 csv 파일 데이터를 owners, stores 테이블에 insert */
async function setOwnersAndStoresDB() {
    let filePath = path.join(__dirname, "./stores.csv")
    let data = fs.readFileSync(filePath, { encoding: "utf8" });
    // console.log(data)

    let rows = data.split("\n");
    // console.log(rows)

    /* 가져온 가게이름, 주소 정보에 사장님 이름, 이메일, 연락처 정보를 추가하자 */


    let insert_into_owners = new Array(); /* [ ['owner_name', 'owner_email', 'owner_phone'], ... ] */
    let insert_into_stores = new Array(); /* [ ['owner_email', 'store_name', 'store_address'], ... ]  */

    for (let i = 1; i < rows.length; i++) {
        let row = rows[i].split(',') // 2,가배도 신논현,서울 강남구 강남대로110길 13 2,3층

        /* address 비어 있으면 continue */
        if (row[2].length === 1) continue

        /* owner data 만들기 */
        let tmp = new Array();
        tmp.push('baro' + row[0]) // owner_name 
        tmp.push(row[0] + '@' + 'baro.com') // owner_email
        let phone = row[0]; // owner_phone
        if (phone.length === 1) {
            phone = '00' + phone
        } else if (phone.length === 2) {
            phone = '0' + phone
        }
        phone += '-0000-0000'

        tmp.push(phone)
        insert_into_owners.push(tmp)

        /* store data 만들기 */
        let tmp2 = new Array();
        tmp2.push(tmp[1]) // owner_email --> key로 사용
        tmp2.push(row[1]) // store_name
        tmp2.push(row[2].split('\r')[0]) // store_address
        insert_into_stores.push(tmp2)
    }
    console.log(insert_into_stores);
    console.log(insert_into_stores);

    insertDummyInto_owners_and_stores(insert_into_owners, insert_into_stores) // db에 insert
}

async function insertDummyInto_owners_and_stores(owners_data, stores_data) {
    let len = owners_data.length
    const con = await pool.getConnection(async conn => conn);
    const sql = "INSERT INTO owners (name, email, phone) VALUES ?";
    await con.query(sql, [owners_data]) // 된다.

    let insert_stores_array = Array();

    /* owner_id 가져오기 */
    let email_all = Array();
    for (let i = 0; i < len; i++) {
        email_all.push(stores_data[i][0])
    }

    const sql2 = `SELECT owner_id, email FROM owners WHERE email IN (?)`
    const [result] = await con.query(sql2, [email_all]);

    let owner_id_and_email = {};
    for (let i = 0; i < len; i++) {
        owner_id_and_email[result[i]['email']] = result[i]['owner_id']
    }

    for (let i = 0; i < len; i++) {
        let pos;
        pos = await getPosition(stores_data[i][2]) // address
        // pos = [10, 11]
        if (pos === -1) continue

        // let key = stores_data[i][0]

        let tmp = Array();
        tmp.push(owner_id_and_email[stores_data[i][0]])
        tmp.push(stores_data[i][1])
        tmp.push(stores_data[i][2])
        tmp.push(pos[0])
        tmp.push(pos[1])
        if (i % 9 === 0) tmp.push(stores_data[i][1] + '입니다. 빠릿한 알바생 환영합니다!')
        else if (i % 8 === 0) tmp.push('편하게 연락주세요. 예의바른 분 환영~')
        else if (i % 7 === 0) tmp.push(stores_data[i][1] + '에서 책임감 강한 분을 찾습니다. 잘 부탁드려요.')
        else if (i % 6 === 0) tmp.push('함께 오랫동안 좋은 관계를 맺어봐요 ^ㅡ^')
        else if (i % 5 === 0) tmp.push('대충 대충 책임감 없는 사람은 연락하지 마세요.')
        else tmp.push('오랫동안 일해주실 필요 없고 짬날 때 와서 편하게 일하셔요.')
        tmp.push(9160)

        /* 한 매장의 완성된 data push */
        insert_stores_array.push(tmp);
    }

    const sql3 = "INSERT INTO stores (FK_stores_owners, name, address, latitude, longitude, description, minimum_wage) VALUES ?";
    await con.query(sql3, [insert_stores_array])

    con.release();
}

/* jobs 세팅 */
async function insertDummyInto_jobs() {
    const con = await pool.getConnection(async conn => conn);
    const sql = `INSERT INTO jobs (type) VALUES ?`

    let job = [['청소'], ['카운터'], ['서빙'], ['설거지'], ['전단지'], ['매장정리'], ['주방보조'], ['경호'], ['배달'], ['전화상담'], ['설문조사']]
    await con.query(sql, [job])
    con.release()
}

/* store_job_lists 세팅 */
async function insertDummyInto_store_job_lists() {
    const con = await pool.getConnection(async conn => conn);
    const sql = `INSERT INTO store_job_lists (FK_store_job_lists_stores, FK_store_job_lists_jobs) VALUES ?`
    let data = new Array()

    /* case 1. */
    let job_id = 1;
    for (let i = 1; i < 443; i++) {
        data.push([i, job_id])
        job_id += 1
        if (job_id === 11)
            job_id = 1
    }

    /* case 2. */
    job_id = 1;
    for (let i = 3; i < 443; i += 3) {
        data.push([i, job_id])
        job_id += 1
        if (job_id === 11)
            job_id = 1
    }

    await con.query(sql, [data])
    con.release()
}


// 1. 총 일수 계산 - number_of_days
// let s_date = new Date(start_date)
// let e_date = new Date(end_date)
// let number_of_days = (e_date.getTime() - s_date.getTime()) / (1000 * 60 * 60 * 24) + 1
// let work_date_list = new Array();

// for (let i = 0; i < number_of_days; i++) {
//   let tmp = new Date(start_date)
//   tmp.setDate(s_date.getDate()+i)
//   work_date_list.push(tmp)
// }

// // 2. 총 시간 계산 - number_of_hours
// let job_id; 
// let s_time = Number(start_time.split(":")[0])
// let e_time = Number(end_time.split(":")[0])
// let number_of_hours = e_time - s_time
// let start_time_list = new Array();

// for (let i = 0; i < number_of_hours; i++) {
//   start_time_list.push((s_time+i).toString()+':00:00')
// }

/* 실행 시 의뢰 조건에 맞게 orders, hourlyorders 테이블에 insert */
async function insertDummyInto_orders(number) {
    const con = await pool.getConnection(async conn => conn);

    let store_id;
    let job_id;
    let description;
    let description_list = [
        "알바하러 오세용, 일이 그렇게 어렵지 않아요~",
        "알바 구합니다. 빠릿한 분만.",
        "넓고 쾌적한 매장에서 함께 일할 분 찾습니다!!",
        "시급높고 강도낮은 여기가 알바하기엔 천국이여.",
        "드루와, 잘해줄게",
        "간단한 업무, 책임감 있는 자 이리로 오라",
        "사고만 치지 마세요. 그럼 모두 OK",
        "가족처럼 일 할 사람을 찾고 있어요~",
        "오래오래 함께 맞춰나갈 분 환영, 대환영!!",
        "철새는 지나가주세요.",
        "알바 뽑습니다.",
        "많은 관심 부탁드려용ㅎㅎ",
        "혼자 일하기 진짜 힘듭니다 도와주세요.",
        "요즘은 알바가 아니라 알바님이라고 불러야 겠어요.",
        "알바님, 환영합니다.",
        "사장님이 젋고 착하신 가게를 찾는다면 이곳입니당~",
        "여보세요, 알바 찾으세요?",
        "힘든 일은 아니니 겁먹지 마세요.",
        "모집공고만 보고 지나가면 나빠요~",
        "시급이 부족하면 올려달라고 하셔도 되는 매장",
        "여~ 일해볼텐가?",
    ]
    let min_price;

    let order_id;
    let start_day;
    let end_day;
    let work_date;
    let start_hour;
    let end_hour;
    let start_time;

    for (let i = 0; i < number; i++) {
        console.log('i: ',i)
        // 매번 랜덤하게 지정
        store_id = Math.floor(Math.random() * (443 - 1)) + 1
        job_id = Math.floor(Math.random() * (12 - 1)) + 1
        des_number = Math.floor(Math.random() * (description_list.length - 1 - 0)) + 0
        description = description_list[des_number]
        min_price = (Math.floor(Math.random() * (140 - 98)) + 98) * 100

        let tmp_order = [store_id, job_id, description, min_price];
        const sql_insert_to_orders = `INSERT INTO orders SET FK_orders_stores=?, FK_orders_jobs=?, description=?, min_price=?, status=0`
        await con.query(sql_insert_to_orders, [store_id, job_id, description, min_price])

        const sql_get_order_id = `SELECT order_id FROM orders ORDER BY order_id DESC LIMIT 1`
        const [result] = await con.query(sql_get_order_id)
        order_id = result[0]['order_id']
        start_day = 14
        end_day = 14
        // start_day = (Math.floor(Math.random() * (30 - 1)) + 1)
        // end_day = (Math.floor(Math.random() * (30 - start_day)) + start_day)
        number_of_days = end_day - start_day + 1

        start_hour = (Math.floor(Math.random() * (24 - 0)) + 0)
        end_hour = (Math.floor(Math.random() * (25 - (start_hour + 1)) + (start_hour + 1)))
        number_of_hours = end_hour - start_hour

        // console.log('start_day: ', start_day)
        // console.log('end_day: ', end_day)
        // console.log('start_hour: ', start_hour)
        // console.log('end_hour: ', end_hour)

        let insert_data_for_hourlyorders_table = Array(); // [[FK_hourlyorders_orders, work_date, start_time],...]

        for (let j = 0; j < number_of_days; j++) {
            let work_day = (start_day + j).toString()
            if (work_day.length === 1) work_day = '0' + work_day
            work_date = '2022-08-' + work_day // 2022-08-11

            for (let k = 0; k < number_of_hours; k++) {
                let tmp = (start_hour + k).toString()
                if (tmp.length === 1) tmp = '0' + tmp
                start_time = work_date + ' ' + tmp + ':00:00'
                // console.log('work_date: ',work_date, ', start_time: ',start_time)
                insert_data_for_hourlyorders_table.push([order_id, work_date, start_time])
            }
        }
        const sql_insert_to_hourlyorders = `INSERT INTO hourly_orders (FK_hourlyorders_orders, work_date, start_time) VALUES ?`
        await con.query(sql_insert_to_hourlyorders, [insert_data_for_hourlyorders_table])
        console.log('success')
    }
}
// insert_dummy_into_orders(10)

async function auto_order() {
    let store_id;
    let job_id;
    let description;
    let description_list = [
        "알바하러 오세용, 일이 그렇게 어렵지 않아요~",
        "알바 구합니다. 빠릿한 분만.",
        "넓고 쾌적한 매장에서 함께 일할 분 찾습니다!!",
        "시급높고 강도낮은 여기가 알바하기엔 천국이여.",
        "드루와, 잘해줄게",
        "간단한 업무, 책임감 있는 자 이리로 오라",
        "사고만 치지 마세요. 그럼 모두 OK",
        "가족처럼 일 할 사람을 찾고 있어요~",
        "오래오래 함께 맞춰나갈 분 환영, 대환영!!",
        "철새는 지나가주세요.",
        "알바 뽑습니다.",
        "많은 관심 부탁드려용ㅎㅎ",
        "혼자 일하기 진짜 힘듭니다 도와주세요.",
        "요즘은 알바가 아니라 알바님이라고 불러야 겠어요.",
        "알바님, 환영합니다.",
        "사장님이 젋고 착하신 가게를 찾는다면 이곳입니당~",
        "여보세요, 알바 찾으세요?",
        "힘든 일은 아니니 겁먹지 마세요.",
        "모집공고만 보고 지나가면 나빠요~",
        "시급이 부족하면 올려달라고 하셔도 되는 매장",
        "여~ 일해볼텐가?",
    ]
    let min_price;

    let order_id;
    let start_day;
    let end_day;
    let work_date;
    let start_hour;
    let end_hour;
    let start_time;

    /* 랜덤 지정 */
    store_id = Math.floor(Math.random() * (443 - 1)) + 1
    job_id = Math.floor(Math.random() * (12 - 1)) + 1
    des_number = Math.floor(Math.random() * (description_list.length - 1 - 0)) + 0
    description = description_list[des_number]
    min_price = (Math.floor(Math.random() * (140 - 98)) + 98) * 100

    let tmp_order = [store_id, job_id, description, min_price];
    const sql_insert_to_orders = `INSERT INTO orders SET FK_orders_stores=?, FK_orders_jobs=?, description=?, min_price=?, status=0`
    await con.query(sql_insert_to_orders, [store_id, job_id, description, min_price])

    const sql_get_order_id = `SELECT order_id FROM orders ORDER BY order_id DESC LIMIT 1`
    const [result] = await con.query(sql_get_order_id)
    order_id = result[0]['order_id']
    start_day = (Math.floor(Math.random() * (15 - 1)) + 1)
    end_day = (Math.floor(Math.random() * (15 - start_day)) + start_day)
    number_of_days = end_day - start_day + 1

    start_hour = (Math.floor(Math.random() * (24 - 0)) + 0)
    end_hour = (Math.floor(Math.random() * (25 - (start_hour + 1)) + (start_hour + 1)))
    number_of_hours = end_hour - start_hour

    for (let j = 0; j < number_of_days; j++) {
        let work_day = (start_day + j).toString()
        if (work_day.length === 1) work_day = '0' + work_day
        work_date = '2022-08-' + work_day // 2022-08-11

        for (let k = 0; k < number_of_hours; k++) {
            let tmp = (start_hour + k).toString()
            if (tmp.length === 1) tmp = '0' + tmp
            start_time = work_date + ' ' + tmp + ':00:00'
            // console.log('work_date: ',work_date, ', start_time: ',start_time)
            insert_data_for_hourlyorders_table.push([order_id, work_date, start_time])
        }
    }
}

/* qualifications 테이블에 특정 계정을 마스터로 */
async function insertDummyInto_qualifications(worker_id) {
    const con = await pool.getConnection(async conn => conn);
    const sql = `INSERT INTO qualifications (FK_qualifications_workers, FK_qualifications_stores) VALUES ?`
    let data = new Array();

    for (let i = 1; i < 423; i++) {
        let tmp = [worker_id, i]
        data.push(tmp)
    }

    await con.query(sql, [data])
    con.release();
}

// insertDummyInto_qualifications(6);


async function getPosition(address) {
    const regionLatLongResult = await geocoder.geocode(address);
    try {
        const Lat = regionLatLongResult[0].latitude; //위도
        const Long = regionLatLongResult[0].longitude; //경도
        return [Lat, Long];
    } catch {
        return -1;
    }
}

/* 사장님 이름, email을 그럴싸하게 변경해보자 */
async function updateOwnersName () {
    let first = ['김', '이', '박', '최', '왕', '권', '차', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '황', '안', '송', '전', '홍', '유', '고', '문', '양', '손', '배', '허', '남']
    let second = ['민', '준', '서', '도', '윤', '예', '시', '우', '하', '주', '원', '호', '경', '업', '후', '지', '건', '현', '도', '연', '은', '정', '시', '임', '성', '숙', '남', '복']
    
    // 442개의 이름을 만들자
    let names = new Array();
    let first_idx;
    let second_idx;
  
    for (let i = 0; i < 442; i++) {
      first_idx = (Math.floor(Math.random() * (first.length - 0)) + 0)
      second_idx = (Math.floor(Math.random() * (second.length - 0)) + 0)
      third_idx = (Math.floor(Math.random() * (second.length - 0)) + 0)
  
      names.push(first[first_idx]+second[second_idx]+second[third_idx])
    }
  
    const con = await pool.getConnection(async conn => conn);
    const sql = `UPDATE owners SET name=? WHERE owner_id=?`
  
    for (let i = 0; i < 442; i++) {
      await con.query(sql, [names[i],i+1])
    }
    con.release()
  
  }
//   updateOwnersName()
  