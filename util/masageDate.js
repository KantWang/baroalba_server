const { Router } = require("express");

require('dotenv').config();



/* '2022-08-20 00:00:000Z' 형식의 input을 '0000-00-00'형식으로 변환하여 리턴 */
function masageDateToYearMonthDay(date_timestamp) {
    let date = new Date(date_timestamp);
    let year = date.getFullYear().toString();
    let month = (date.getMonth() + 1).toString();
    let day = date.getDate().toString();
  
    if (month.length === 1) month = "0" + month;
    if (day.length === 1) day = "0" + day;
  
    return year + "-" + month + "-" + day;
}
  
  /* '2022-08-20 00:00:000Z' 형식의 input을 '0000-00-00 00:00:00'형식으로 변환하여 리턴 */
function masageDateToYearMonthDayHourMinSec(date_timestamp) {
    let date = new Date(date_timestamp);
    let hour = date.getHours().toString();
    let min = date.getMinutes().toString();
    let sec = date.getSeconds().toString();
  
    if (hour.length === 1) hour = "0" + hour;
    if (min.length === 1) min = "0" + min;
    if (sec.length === 1) sec = "0" + sec;
  
    return (
      masageDateToYearMonthDay(date_timestamp) +
      " " +
      hour +
      ":" +
      min +
      ":" +
      sec
    );
}
  
/* '0000:00:00 ??:00:00.000Z' 형식을 받아서 '??:00' return */
function masageDateToHour(timestamp) {
    timestamp = new Date(timestamp);
    let hour = timestamp.getHours().toString();
    if (hour.length === 1) hour = '0' + hour;

    return hour + ':00';
}



module.exports.masageDateToYearMonthDay = masageDateToYearMonthDay;
module.exports.masageDateToYearMonthDayHourMinSec = masageDateToYearMonthDayHourMinSec;
module.exports.masageDateToHour = masageDateToHour;
