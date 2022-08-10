const { Router } = require('express');
const ownerMypageRouter = Router();

const workRouter = require('./mypage/work');
const myWorkerRouter = require('./mypage/myWorker');
const interviewRouter = require('./mypage/interview');
const employmentRouter = require('./mypage/employment');
const imageUploadRouter = require('./mypage/imageUpload');

const pool = require('../../util/function');

ownerMypageRouter.post('/', async (req, res) => {
    const con = await pool.getConnection(async (conn) => conn);
    // console.log('##### start owner/name #####');
    // console.log(req.body);
    try {
        const sql_owner = `SELECT name FROM owners WHERE owner_id = ${req.body['owner_id']};`;
        const [result_owner] = await con.query(sql_owner);
        const owner_name = result_owner[0]['name'];
        const sql_store = `SELECT name from stores where FK_stores_owners = ${req.body['owner_id']};`;
        const [result_store] = await con.query(sql_store);
        const store_name = result_store[0]['name'];
        con.release();
        res.send({ name: owner_name, store: store_name });
    } catch {
        con.release();
        res.send('error');
    }
});

ownerMypageRouter.use('/work', workRouter);
ownerMypageRouter.use('/myWorker', myWorkerRouter);
ownerMypageRouter.use('/interview', interviewRouter);
ownerMypageRouter.use('/employment', employmentRouter);
ownerMypageRouter.use('/imageUpload', imageUploadRouter);

module.exports = ownerMypageRouter;

/************************ function *************************/
