import React, { useContext } from 'react'
import "./homePage.scss"
import SearchBar from '../../components/searchBar/SearchBar'
import { AuthContext } from '../../context/AuthContext'

export default function HomePage() {

    const {currentUser}=useContext(AuthContext)

  return (
    <div className='homepage'>
        <div className="textContainer">
            <div className="wrapper">
                <h1 className='title'>Find Real Estate & Get Your Dream Place</h1>
                <p>
                Discover the perfect home tailored to your needs with our comprehensive real estate platform. 
                Whether you're buying, selling, or renting, we make your dream home a reality.                </p>
                <SearchBar/>
                <div className="boxes">
                    <div className="box">
                        <h1>18+</h1>
                        <h2>Years of Experience</h2>
                    </div>
                    <div className="box">
                        <h1>200</h1>
                        <h2>Award Gained</h2>
                    </div>
                    <div className="box">
                        <h1>1200+</h1>
                        <h2>Property Ready</h2>
                    </div>
                </div>
            </div>
        </div>
        <div className="imgContainer">
            <img src='bg.png' alt='bg img'/>
        </div>
    </div>
  )
}
