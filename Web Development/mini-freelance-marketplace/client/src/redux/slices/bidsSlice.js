import { createSlice } from '@reduxjs/toolkit';
const initialState = {
    bids_loading: false,
    bids: [],
    page: 1,
    hasMore: false,
    selectedBid: null,
    selectedUser: null
};

const bidsSlice = createSlice({
    name: "bids",
    initialState,
    reducers: {
        setBidsLoading(state, value) {
            state.bids_loading = value.payload;
        },
        setBids(state, value) {
            state.bids = value.payload;
        },
        appendBids(state, value) {
            state.bids.push(...value.payload);
        },
        resetBids(state) {
            state.bids = [];
            state.page = 1;
            state.hasMore = true;
        },
        setPage(state, value) {
            state.page = value.payload;
        },
        setHasMore(state, value) {
            state.hasMore = value.payload;
        },
        setSelectedBid(state, value) {
            state.selectedBid = value.payload;
        },
        setSelectedUser(state, value) {
            state.selectedUser = value.payload;
        }
    },
});

export const { setBidsLoading, setBids, appendBids, resetBids, setPage, setHasMore, setSelectedBid, setSelectedUser } = bidsSlice.actions;

export default bidsSlice.reducer;