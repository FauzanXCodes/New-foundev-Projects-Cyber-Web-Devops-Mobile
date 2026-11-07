
import ListPage from './routes/listPage/ListPage';
import HomePage from './routes/homePage/HomePage'
import SinglePage from './routes/singlePage/Singlepage'
import Login from './routes/login/Login'
import Register from './routes/register/register'
import {
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";
import {Layout, RequireAuth } from './routes/layout/Layout';
import Profile from './routes/profilePage/ProfilePage';
import ProfileUpdatePage from './routes/profileUpdatePage/profileUpdatePage';
import NewPostPage from './routes/newPostPage/NewPostPage.jsx';
import { listPageLoader, profilePageLoader, singlePageLoader } from './lib/loader.js';


function App() {

  const router = createBrowserRouter([
    {
      path: "/",
      element: <Layout/>,
      children: [
        {
          path: "/",
          element: <HomePage/>
        },
        {
          path: "/list",
          element: <ListPage/>,
          loader: listPageLoader
        },
        {
          path: "/:id",
          element: <SinglePage/>,
          loader: singlePageLoader
        },
        {
          path:"/login",
          element:<Login/>
        },
        {
          path:"/register",
          element:<Register/>
        }

      ]
    },
    {
      path: "/",
      element: <RequireAuth/>,
      children:[
        {
          path: "/profile",
          element: <Profile/>,
          loader: profilePageLoader
        },
        {
          path: "/profile/update",
          element: <ProfileUpdatePage/>
        },
        {
          path: "/add",
          element: <NewPostPage/>
        },
      ]
    }
  ])

  return (
    <RouterProvider router={router}/>
  )
}

export default App