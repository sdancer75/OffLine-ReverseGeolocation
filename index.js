/************************************************************************
* reverseGeoLoc 
* A simple offline Reverse Geolocation.
*
*
*   George Papaioannou 2023
*   a.k.a shadow dancer
*
* Credits : Thomas Steiner  https://github.com/tomayac/local-reverse-geocoder
*           GeoNames geographical database  https://download.geonames.org/export/dump/  
*
* Important note : It supports ONLY Greece Geolocation
*
************************************************************************/


var reverseGeoLoc = require('./reverse-geoloc');
 

 console.log("Searching.... please wait");
 reverseGeoLoc(40.10753, 22.48228, (err, data) => {

  if (err)
    console.log("Error :", err)
  else
    console.log(data)

 });



