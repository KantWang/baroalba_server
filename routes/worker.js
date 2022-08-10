const { Router } = require('express');
const workerRouter = Router();

const signupRouter = require('./worker/signup');
const idRouter = require('./worker/id');
const locationRouter = require('./worker/location');
const rangeRouter = require('./worker/range');
const reservationRouter = require('./worker/reservation');
const showRouter = require('./worker/show');
const suggestionRouter = require('./worker/suggestion');
const mypageRouter = require('./worker/mypage');
const addrRouter = require('./worker/addr');
const angelRouter = require('./worker/angel');


workerRouter.use('/signup', signupRouter);
workerRouter.use('/id', idRouter);
workerRouter.use('/location', locationRouter);
workerRouter.use('/range', rangeRouter);
workerRouter.use('/reservation', reservationRouter);
workerRouter.use('/show', showRouter);
workerRouter.use('/suggestion', suggestionRouter);
workerRouter.use('/mypage', mypageRouter);
workerRouter.use('/addr', addrRouter);
workerRouter.use('/angel', angelRouter);

 
module.exports = workerRouter;

/************************ function *************************/

