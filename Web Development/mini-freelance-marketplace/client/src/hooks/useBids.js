import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import { bidsApi } from "../services/api";
import { appendBids, setBids, setBidsLoading, setHasMore } from "../redux/slices/bidsSlice";
import toast from "react-hot-toast";

export const useBids = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const location = useLocation();
    const { bids_loading, bids, page, hasMore } = useSelector((state) => state.bids);
    const { loading, is_logged_in, user, error, email, navigation } = useSelector((state) => state.auth);
    const registerBid = async (data, handleClose) => {
        try {
            dispatch(setBidsLoading(true));
            const response = await bidsApi.createBid(data);
            if (response.data.message === "bid_registered") {
                handleClose()
                toast.success("Bid Registered Successfully", { duration: 2000, position: 'bottom-right' })
            }
            dispatch(setBidsLoading(false));
            return response;
        } catch (error) {
            handleClose()
            dispatch(setBidsLoading(false));
            throw error;
        }
    };

    const hire = async (bidId, projectId) => {
        try {
            dispatch(setBidsLoading(true));
            const response = await bidsApi.hire(bidId, projectId);
            if (response.data.message === "freelancer_hired") {
                toast.success("Freelancer Hired Successfully", { duration: 2000, position: 'bottom-right' })
            }
            dispatch(setBidsLoading(false));
            return response;
        } catch (error) {
            dispatch(setBidsLoading(false));
            throw error;
        }
    };

    const fetchBids = async (data) => {
        try {
            dispatch(setBidsLoading(true));
            const response = await bidsApi.getProjects(data);
            if (response.data.message === "bids_received") {
                dispatch(setHasMore(response.data.hasMore));
                if (Number(data.page) > 1) {
                    dispatch(appendBids(response.data.projects));
                } else {
                    dispatch(setBids(response.data.projects));
                }
            }
            dispatch(setBidsLoading(false));
            return response;
        } catch (error) {
            dispatch(setBidsLoading(false));
            throw error;
        }
    };
    return {
        registerBid,
        hire,
        fetchBids
    };
};

export default useBids; 