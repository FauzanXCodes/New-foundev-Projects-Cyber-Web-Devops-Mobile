import React, { useContext } from 'react'
import "./navbar.scss"
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AuthContext } from '../../context/AuthContext'
import { useNotificationStore } from '../../lib/notificationStore'


export default function Navbar() {

  const [open,setOpen]=useState(false)
  const user=true;

  const {currentUser}=useContext(AuthContext)

  const fetch = useNotificationStore((state) => state.fetch);
  const number = useNotificationStore((state) => state.number);

  if(currentUser) fetch()

  return (
    <nav>
        <div className="left">
            <a href='/' className='logo'>
                <img src="logo.png" alt="logo"/>
                <span>MotoEstate</span>
            </a>
            <a href="/">Home</a>
            <a href="">About</a>
            <a href="">Contacts</a>
            <a href="">Agents</a>
        </div>
        <div className="right">
          {
            currentUser ? 
              <div className='user'>
                <img src={currentUser.avatar || "/noavatar.jpg"} alt="" />
                <span>{currentUser.username}</span>
                <Link to="/profile" className="profile">
                  {number>0 && <div className="notification">{number}</div>}
                  <span>Profile</span>
                </Link>
              </div> : 
              <>
              <a href="/login">SignIn</a>
              <a href="/register" >Sign Up</a>
              </>
          }
            <div className="menuIcon">
              <img src="menu.png" alt="menuImg" 
                 onClick={()=>setOpen(!open)}
              />
            </div>
            <div className={open? "menu active":"menu"}>
              <a href="/">Home</a>
              <a href="">About</a>
              <a href="">Contacts</a>
              <a href="">Agents</a>
              <a href="/login">Sign In</a>
              <a href="/register">Sign Up</a>
            </div>
        </div>
    </nav>
  )
}
