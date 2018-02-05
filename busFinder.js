 L.mapbox.accessToken = 'pk.eyJ1IjoiaGFubmFoa2VyIiwiYSI6ImNpdHEzcndkajAwYmwyeW1zd2UxdTAwMnMifQ.hYglJOOC0Mhq7xNYOxc6qg';
var map = L.mapbox.map('map', 'mapbox.streets')
    .setView([45.517, -122.675], 12);

//link to get what we want from the fusion table - SQL query 
var link = 'https://www.googleapis.com/fusiontables/v1/query?sql=SELECT%20stop_name,%20stop_id,%20stop_lat,%20stop_lon%20FROM%201IHnas3kyhalaAs47by1Ty6d5rchOF7LVLhs78QMR&key=AIzaSyBTMJbCdUBuSjz1BXsZGfxU9zhOzQ9YI-4';

//-------------------------------------------------global variables --------------------------------------------------

//creates three arrays that have information about the bus stops 
var stopLat = []; 
var stopLon = []; 
var stopName = [];
var stopId = []; 
//array of bus stop objects 
var allData = [];
//array of distances to each bus stop
var distance = []; 
//variables to store the lat/long of where the user clicks 
var clickLat; 
var clickLong; 
//lat long location of the selected bus stop 
var selectMarker; 
var selectMarkerLat;
var selectMarkerLong;  
//array holding all of the displayed bus stop markers 
var markers = [];
//link for the bus data json feed 
var busData; 
//the stop Id of the stop that was clicked on 
var stopID;  
//distance from user location to bus stop
var stopDistance; 
//time from user location to bus stop
var stopTime; 
//position of the closest bus 
var closestBusLat; 
var closestBusLong; 
//distance between the closest bus and the bus stop
var busDistance;
//time for the bus to get to the stop
var busTime;  
//real time data of bus positions 
var arrivalData;
//string variable holding 
var inTime; 
//popup for the marker with the final information 
var popup2 = L.popup(); 
var myStop; 
function reload(){
    window.location.reload();
};
 
 //----------------------------------------------------------------------------------------------------------

//JQuery call to get the data 
$.ajax({
    url: link, 
    dataType: 'json',
    //this happens if the data loads successfully 
    success: function(data){
        var rows = data['rows'];
        for(var i in rows){
            //create arrays for each of the attributes 
            stopName.push(rows[i][0]);
            stopId.push(rows[i][1]);
            stopLat.push(rows[i][2]); 
            stopLon.push(rows[i][3]);
        }

        //use to create bus stop objects 
        function busStop(name, id, lat, long, distance){
            this.name = name; 
            this.lat = lat; 
            this.id = id; 
            this.long = long; 
            this.distance = distance;    
        }
        
        var length = stopName.length; //it's over 6000..

        //fill the array of bus stop objects - no distance values 
        function buildBusStop1(){
            for(var i=0; i<length; i++){
                allData[i] = new busStop(stopName[i], stopId[i], stopLat[i], stopLon[i], 0);
            }
        }

        //fill the array of bus stop objects - distance values calculated 
         function buildBusStop2(){
            for(var i=0; i<length; i++){
                allData[i] = new busStop(stopName[i], stopId[i], stopLat[i], stopLon[i], distance[i]);
            }
        }

        //calculate the distance to each stop
        function calcDistance(){
            for(var i=0; i<length; i++){    
                distance[i] = Math.sqrt(Math.pow((allData[i].long - clickLong),2) + Math.pow((allData[i].lat - clickLat), 2));
            } 
        }

        //get bus stops with 10 shortest distances and display them 
        function closestStops(){
            allData.sort(function(a,b){return (a.distance) - (b.distance)}); 
            for(var i=0; i<5; i++){
                markers[i] = L.marker([allData[i].lat, allData[i].long], {icon: myIcon, title: allData[i].name})
                markers[i].addTo(map).on('click', markerClick);
               // L.marker([allData[i].lat, allData[i].long], {icon: myIcon, title: allData[i].name}).addTo(map).on('click', markerClick); 
                //how to get the old markers to be removed? Does it matter?
            }
        }

         //retrieve the bus stop ID # from the marker that was clicked 
        function getStopID(){
            for(var i=0; i<10; i++){
                if((selectMarkerLat == allData[i].lat) && (selectMarkerLong == allData[i].long)){
                    stopID = allData[i].id; 
                }
            }
        }

        function distanceToStop(){
            stopDistance = Math.sqrt(Math.pow((selectMarkerLong - clickLong),2) + Math.pow((selectMarkerLat - clickLat), 2));
            //still need to add conversion from dd to km - using the conversion of 0.1km/min
            //time is in minutes 
            stopTime = stopDistance * 79 /6; 
        }

        //load the json data feed with bus stop id as parameter 
        function loadFeed(){
            //build the url for the json feed 
            var part2 = stopID.toString(); 
            var part1 = 'https://developer.trimet.org/ws/V2/arrivals/locIDs/';
            var part3 =  '/appID/30BE7218095886D573C04A41C/json/true/showPosition/true';
            busData =  part1.concat(part2).concat(part3);

            

           var request = new XMLHttpRequest();
            request.open('GET', busData);
            request.responseType = 'json'; 
            
            //happens when the data feed loads 
            request.onload = function() { 
            arrivalData = request.response;

           if(arrivalData.resultSet.arrival[0].feet == null){
                    closestBusLat = 0;
                    closestBusLong = 0;
                }
                else{
                    closestBusLat = arrivalData.resultSet.arrival[0].blockPosition.lat;
                    closestBusLong = arrivalData.resultSet.arrival[0].blockPosition.lng;
                }

            //add a marker in for the current bus position 
            var bus = L.marker([closestBusLat, closestBusLong], {icon: busIcon, title: 'Nearest bus location'})
                bus.addTo(map)

            busToStopDist(); 
            makeIt();

            //content for the marker 
            if(arrivalData.resultSet.arrival[0].feet == null){
                popup2.setContent("Bus tracking error...please select another stop");
            }
           else{
                popup2.setContent('The next bus is ' + arrivalData.resultSet.arrival[0].blockPosition.signMessage + '. Your bus is about ' + Math.round(busTime * 60) + ' minute(s) away. You are about ' + Math.round(stopTime* 60) + ' minute(s) away. ' + inTime + '!' ); 
           } 
            }

            request.send();
        }

        //distance from the closest bus to the selected bus stop
        function busToStopDist(){
            busDistance = Math.sqrt(Math.pow((selectMarkerLong - closestBusLong),2) + Math.pow((selectMarkerLat - closestBusLat), 2));
            busTime = busDistance * 79 /40; 
        }

        //will you make it to the bus stop or not?
        function makeIt(){
            if(stopTime<busTime){
                inTime = 'You can make it to the stop in time'; 
            }
            else{
                inTime = 'You cannot make it to the stop in time'; 
            }
        }


        //assigns lat long to selectMarker variable when a bus stop is selected 
        function markerClick(e){
            selectMarker = this.getLatLng();
            selectMarkerLat = selectMarker.lat; 
            selectMarkerLong = selectMarker.lng; 

            //changes the icon when you click on it
            myStop = L.marker([selectMarkerLat, selectMarkerLong], {icon: userStop, title: 'My stop'});
            myStop.addTo(map); 
             
            getStopID(); 
            distanceToStop(); 
            loadFeed();  

            popup2
                .setLatLng(this.getLatLng())
                
                .openOn(map);
        }
             //custom icons for the markers
             var userStop = L.icon({
                iconUrl: 'myStop.png',
                iconSize: [25,25]
             })

             var myIcon = L.icon({
                iconUrl: 'busIcon.png',
                iconSize: [25,25]
             })

             var busIcon = L.icon({
                iconUrl: 'icon.png',
                iconSize: [10,10]
             })

             var personIcon = L.icon({
                iconUrl: 'placeholder.png',
                iconSize: [20,20]
             })
            

                var popup = L.popup();
            
                //event for when the user initially clicks on their position 
                map.on('click', function (e) {
                     
                   clickLat = e.latlng.lat;
                   clickLong = e.latlng.lng;
                   var bus = L.marker([clickLat, clickLong], {icon: personIcon, title: 'your location'})
                bus.addTo(map)

                   //zoom to where the click happened
                   map.setView(e.latlng, 15);
                   //popup bubble after click 
                    popup
                        .setLatLng(e.latlng)
                        //content for the popup bubble 
                        .setContent("Please select your desired bus stop" )
                        .openOn(map);

                        // run functions
                        buildBusStop1(); 
                        calcDistance(); 
                        buildBusStop2(); 
                        closestStops(); 

                    });//end of click function          
    } //END OF SUCCESS FUNCTION 
}) //END OF AJAX 