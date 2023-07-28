# OffLine-ReverseGeolocation
Simple offline reverse geolocation using CSV files. Written with javascript. Currently, the only country it supports is Greece but it is easy to modify the code to apply for your own country.

The application automatically downloads the country from the https://download.geonames.org/export/dump/ website and creates locally a `data` folder. Unzip the downloaded file and search inside the CSV to return a JSON response from the latitude and longitude you apply.  

Import the module ie ```var reverseGeoLoc = require('./reverse-geoloc')```

Call the module
```
 console.log("Searching.... please wait");
 reverseGeoLoc(40.10753, 22.48228, (err, data) => {

  if (err)
    console.log("Error :", err)
  else
    console.log(data)

 });
```

and wait awhile to get the JSON object.


![JSON return](./reverse.jpg)
