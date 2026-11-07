import React, { useEffect } from 'react'
import { MapContainer,TileLayer } from 'react-leaflet'
import './map.scss'
import 'leaflet/dist/leaflet.css'
import Pin from '../pin/Pin';

export default function Map({items}) {
  const position = [26.83928, 80.92313] 
  return (
    <MapContainer 
        center={
          items.length===1 ?
          [items[0].latitude,items[0].longitude]:
          position} 
        zoom={6} 
        scrollWheelZoom={false}
        className='map'
    >
        <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {items.map((item)=>(
            // console.log(item);
            <Pin item={item} key={item.id}/>
        ))}
    </MapContainer>
  )
}
