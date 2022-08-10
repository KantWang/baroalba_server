const { Router } = require("express");
const pool = require('./function');
const nodeGeocoder = require("node-geocoder");
  
require('dotenv').config();

/* 구글 map api */
const options = {
    provider: "google",
    apiKey: "AIzaSyAHZxHAkDSHoI-lJDCg5YfO7bLCFiRBpaU", // 요놈 넣어만 주면 될듯?
  };
  const geocoder = nodeGeocoder(options);
  
  

/* 두 개의 좌표 간 거리 구하기 */
function getDistance(lat1, lon1, lat2, lon2) {
    if (lat1 == lat2 && lon1 == lon2) return 0;
  
    let radLat1 = (Math.PI * lat1) / 180;
    let radLat2 = (Math.PI * lat2) / 180;
  
    let theta = lon1 - lon2;
    let radTheta = (Math.PI * theta) / 180;
    let dist =
      Math.sin(radLat1) * Math.sin(radLat2) +
      Math.cos(radLat1) * Math.cos(radLat2) * Math.cos(radTheta);
  
    if (dist > 1) dist = 1;
  
    dist = Math.acos(dist);
    dist = (dist * 180) / Math.PI;
    dist = dist * 60 * 1.1515 * 1.609344 * 1000;
  
    if (dist < 100) dist = Math.round(dist / 10) * 10;
    else dist = Math.round(dist / 100) * 100;
  
    return dist;
  }
  
/* 두 좌표 간 거리 구하기 */
async function getPos(location) {
    // console.log(">>>>", req.body);
    const regionLatLongResult = await geocoder.geocode(location);
    const Lat = regionLatLongResult[0].latitude; //위도
    const Long = regionLatLongResult[0].longitude; //경도
    return [Lat, Long];
}

module.exports.getDistance = getDistance;
module.exports.getPos = getPos;
