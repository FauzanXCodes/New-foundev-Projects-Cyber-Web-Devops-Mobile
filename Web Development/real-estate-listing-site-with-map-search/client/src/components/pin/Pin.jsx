import React from 'react'
import './pin.scss'
import { Link } from 'react-router-dom'
import { Marker,Popup } from 'react-leaflet'
import L from 'leaflet';



export default function Pin({item}) {
  
  const markerIcon = L.icon({
    iconUrl: 'public/marker-icon.png'
  })

  return (
    
    <Marker
      position={[item.latitude,item.longitude]} 
      // icon={markerIcon}
    >
        <Popup>
           <div className="popupContainer">
                <img src={item.img}/>
                <div className="textContainer">
                    <Link to={`/${item.id}`}>{item.title}</Link>
                    <span>{item.bedroom}</span>
                    <b>$ {item.price}</b>
                </div>
           </div>
        </Popup>
    </Marker>
  )
}
