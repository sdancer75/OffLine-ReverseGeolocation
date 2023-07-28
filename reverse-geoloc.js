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
************************************************************************/


var debug = require('debug')('reverse-geoloc');
var fs = require('fs');
var kdTree = require('kdt')
var parser = require('csv-parse');
var parse = parser.parse;

const FOLDER = 'data/';
const CITIES = FOLDER + 'cities500.txt';
const ADMIN_1_CODES_FILE = FOLDER + 'admin1CodesASCII.txt';
const ADMIN_2_CODES_FILE = FOLDER + 'admin2Codes.txt';
const COUNTRIES = FOLDER + 'GR.txt';


var DataAreReady = false;
var citiesData = [];
var countriesData = [];
var Admin1Codes = {};
var Admin2Codes = {};
var Admin3Codes = {};
var kdTreeData = null;


var GEONAMES_COLUMNS = [
  'geoNameId', // integer id of record in geonames database
  'name', // name of geographical point (utf8) varchar(200)
  'asciiName', // name of geographical point in plain ascii characters, varchar(200)
  'alternateNames', // alternatenames, comma separated, ascii names automatically transliterated, convenience attribute from alternatename table, varchar(10000)
  'latitude', // latitude in decimal degrees (wgs84)
  'longitude', // longitude in decimal degrees (wgs84)
  'featureClass', // see http://www.geonames.org/export/codes.html, char(1)
  'featureCode', // see http://www.geonames.org/export/codes.html, varchar(10)
  'countryCode', // ISO-3166 2-letter country code, 2 characters
  'cc2', // alternate country codes, comma separated, ISO-3166 2-letter country code, 60 characters
  'admin1Code', // fipscode (subject to change to iso code), see exceptions below, see file admin2Codes.txt for display names of this code; varchar(20)
  'admin2Code', // code for the second administrative division, a county in the US, see file admin2Codes.txt; varchar(80)
  'admin3Code', // code for third level administrative division, varchar(20)
  'admin4Code', // code for fourth level administrative division, varchar(20)
  'population', // bigint (8 byte int)
  'elevation', // in meters, integer
  'dem', // digital elevation model, srtm3 or gtopo30, average elevation 3''x3'' (ca 90mx90m) or 30''x30'' (ca 900mx900m) area in meters, integer. srtm processed by cgiar/ciat.
  'timezone', // the timezone id (see file timeZone.txt) varchar(40)
  'modificationDate', // date of last modification in yyyy-MM-dd format
];

var GEONAMES_ADMIN_CODES_COLUMNS = [
  'concatenatedCodes',
  'name',
  'asciiName',
  'geoNameId',
];

  // Distance function taken from
  // http://www.movable-type.co.uk/scripts/latlong.html
  const _distanceFunc = (x, y) => {
    var toRadians = function (num) {
      return (num * Math.PI) / 180;
    };
    var lat1 = x.latitude;
    var lon1 = x.longitude;
    var lat2 = y.latitude;
    var lon2 = y.longitude;

    var R = 6371; // km
    var φ1 = toRadians(lat1);
    var φ2 = toRadians(lat2);
    var Δφ = toRadians(lat2 - lat1);
    var Δλ = toRadians(lon2 - lon1);
    var a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

const parseGeoNamesColumns = (file, callback) => {
    debug(`Started parsing ${file} (this  may take a while)`);        
    var saveTo = [];
    var lenI = GEONAMES_COLUMNS.length;
    var content = fs.readFileSync(__dirname + '/' + file);
    parse(content, { delimiter: '\t', quote: '' }, function (err, lines) {
      if (err) {        
        return callback(err, null);
      }
      lines.forEach(function (line) {
        var lineObj = {};
        for (var i = 0; i < lenI; i++) {
          var column = line[i] || null;
          lineObj[GEONAMES_COLUMNS[i]] = column;
        }
        saveTo.push(lineObj);
      });

      debug(`Finished parsing ${file}.`); 

      return callback(null, saveTo);   
  })

}


const _parseGeoNamesCitiesCsv = ( callback ) => {
  parseGeoNamesColumns(CITIES, (err, data) =>{ 
    if (err) {
      debug(`Error parsing ${CITIES}.`); 
      return callback(err)
    } else   {          
      return callback(null, data)
    }
  });  
};

const  _parseGeoNamesCountryCsv = ( callback ) => {
  parseGeoNamesColumns(COUNTRIES, (err, data) =>{ 
    if (err) {
      debug(`Error parsing ${COUNTRIES}.`); 
      return callback(err)
    } else {    
      

      //connect this with Admin3Codes
      for (const object of data) {
        var featureCode = object['featureCode'];
        if (featureCode === 'ADM3' || featureCode === 'ADM4') {
          var lineObj = {
              originalAdmin3Code:object['admin3Code'],
              name: object['name'],
              asciiName: object['asciiName'],
              geoNameId: object['geoNameId'],
          };         
          var key = object['countryCode'] + '.' + object['admin1Code'] + '.' + object['admin2Code'] + '.' + object['admin3Code'];
          Admin3Codes[key] = lineObj;
       }
      }

      return callback(null, data);    
    }
  });      
}

const _parseGeoNamesAdmin1CodesCsv = (callback) => {
    
    debug(`Started parsing ${ADMIN_1_CODES_FILE} (this  may take a while)`);        
    var admin2Codes = {};
    var lenI = GEONAMES_ADMIN_CODES_COLUMNS.length;    

    var content = fs.readFileSync(__dirname + '/' + ADMIN_1_CODES_FILE);
    parse(content, { delimiter: '\t', quote: '' }, function (err, lines) {
      if (err) {   
        debug(`Error parsing`);     
        return callback(err, null);
      }
      lines.forEach(function (line) {                
        for (var i = 0; i < lenI; i++) {        
          var value = line[i] || null;
          if (i === 0) {
              admin2Codes[value] = {};
          } else {
            admin2Codes[line[0]][GEONAMES_ADMIN_CODES_COLUMNS[i]] = value;                              
          };    
        }
      })

      debug(`Finished parsing ${ADMIN_1_CODES_FILE}.`);
      return callback(null, admin2Codes);  
    });



}


  const _parseGeoNamesAdmin2CodesCsv = (callback) => {
    
    debug(`Started parsing ${ADMIN_2_CODES_FILE} (this  may take a while)`);        
    var admin2Codes = {};
    var lenI = GEONAMES_ADMIN_CODES_COLUMNS.length;    

    var content = fs.readFileSync(__dirname + '/' + ADMIN_2_CODES_FILE);
    parse(content, { delimiter: '\t', quote: '' }, function (err, lines) {
      if (err) {   
        debug(`Error parsing`);     
        return callback(err, null);
      }
      lines.forEach(function (line) {                
        for (var i = 0; i < lenI; i++) {        
          var value = line[i] || null;
          if (i === 0) {
              admin2Codes[value] = {};
          } else {
            admin2Codes[line[0]][GEONAMES_ADMIN_CODES_COLUMNS[i]] = value;                              
          };    
        }
      })

      debug(`Finished parsing ${ADMIN_2_CODES_FILE}.`);
      return callback(null, admin2Codes);  
    });

  }



const init = ( callback ) => {
    // Read Cities and make an object for each one of them
    
    _parseGeoNamesCitiesCsv( (err, data) => {

        if (err)
          return callback(err);

        citiesData = data;
        var dimensions = ['latitude', 'longitude'];
        kdTreeData = kdTree.createKdTree(citiesData.flat(),_distanceFunc, dimensions);              
        debug('Finished building k-d tree for specific countries');  
        
        _parseGeoNamesCountryCsv ( (err, data ) => {

          if (err)
            return callback(err);

          countriesData = data;  

          _parseGeoNamesAdmin1CodesCsv( (err, data) => {
            if (err)  
              return callback(err);

            Admin1Codes = data;
           
            _parseGeoNamesAdmin2CodesCsv( (err, data) => {
              if (err)
                return callback(err);
              
              Admin2Codes = data

              debug('Data are loaded successfully and they are read to be read');             
              return callback(null)
            });
          });
        })        
      });
   };

const reverseGeoLoc = (latitude, longitude, callback) => {

  let point={
    latitude: typeof latitude === 'number' ? latitude : parseFloat(latitude),
    longitude:typeof longitude === 'number' ? longitude : parseFloat(longitude),
  }

  init( (err) => { 
      DataAreReady = true;
      debug('Look-up request for point ' + JSON.stringify(point));
      let result = kdTreeData.nearest(point, 1);
      let dataObj = result[0][0]    
      point['result'] = dataObj;
      point['distance'] = result[0][1];

      let countryCode = dataObj.countryCode || '';  
      let admin1Code;
      // Look-up of admin 1 code
      if (Admin1Codes) {                              
        admin1Code = dataObj.admin1Code || '';
        var admin1CodeKey = countryCode + '.' + admin1Code;
        Admin1Codes[admin1CodeKey]['originalAdmin1Code'] = admin1Code;
        point['result']['admin1Code'] =  Admin1Codes[admin1CodeKey] || dataObj.admin1Code;
      }   
      // Look-up of admin 2 code
      let admin2Code;
      if (Admin2Codes) {      
        admin2Code = dataObj.admin2Code || '';
        let admin2CodeKey = countryCode + '.' + admin1Code + '.' + admin2Code;
        Admin2Codes[admin2CodeKey]['originalAdmin2Code'] = admin2Code;
        point['result']['admin2Code'] = Admin2Codes[admin2CodeKey] || dataObj.admin2Code;
      }       
      
      //Look-up of admin 3 code
      if (Admin3Codes) {
        let admin3Code = dataObj.admin3Code || '';
        var admin3CodeKey = countryCode + '.' + admin1Code + '.' + admin2Code + '.' + admin3Code;
        dataObj.admin3Code =  Admin3Codes[admin3CodeKey] || dataObj.admin3Code;
      }      
      
      return callback(err, point)
      

  })
  

}

module.exports = reverseGeoLoc;
	
 






