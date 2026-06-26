import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const hash = window.location.hash;
    const token = searchParams.get("token");
    const queryString = token ? `?token=${token}` : "";
    navigate(`/auth/reset${queryString}${hash}`, { replace: true });
  }, [navigate, searchParams]);

  return null;
};

export default ResetPassword;
