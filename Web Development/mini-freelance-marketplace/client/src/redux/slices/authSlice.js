import { createSlice } from '@reduxjs/toolkit';
import Cookies from 'js-cookie';
const initialState = {
  loading: false,
  email: localStorage.getItem("email") ? localStorage.getItem("email") : null,
  is_logged_in: localStorage.getItem("is_logged_in") ? localStorage.getItem("is_logged_in") : null,
  user: null,
  error: null,
  navigation: null,
  noficcations: [],
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setUser(state, value) {
      state.user = value.payload;
    },
    setLoginStatus(state, value) {
      state.is_logged_in = value.payload;
    },
    setNavigation(state, value) {
      state.navigation = value.payload;
    },
    setLoading(state, value) {
      state.loading = value.payload;
    },
    setEmail(state, value) {
      state.email = value.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
      state.loading = false;
    },
    resetAuth: (state) => {
      state.is_logged_in = false;
      state.email = null;
      state.user = null;
    }
  },
});

export const { setLoading, setLoginStatus, setEmail, setUser, setError, resetAuth, setNavigation } = authSlice.actions;

export default authSlice.reducer;