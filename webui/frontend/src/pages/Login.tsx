"use client";
import { SignInPage } from "@toolpad/core/SignInPage";
import LinearProgress from "@mui/material/LinearProgress";
import { Navigate, useNavigate } from "react-router-dom";
import { useSession } from "@/contexts/SessionContext";

function Login() {
    const { session, signIn, loading } = useSession();
    const navigate = useNavigate();

    if (loading) {
        return <LinearProgress />;
    }

    if (session) {
        return <Navigate to="/" />;
    }

    return (
        <SignInPage 
            providers={[{ id: "credentials", name: "Credentials" }]}
            slotProps={{
                emailField: {
                    label: "Username",
                    placeholder: "username",
                    type: "text"
                }
            }}
            signIn={async (_provider, formData, callbackUrl) => {
                const username = formData?.get('email') as string;
                const password = formData?.get('password') as string;
                if (!username || !password) {
                    return { error: 'Username and password are required' };
                }
                try {
                    await signIn(username, password);
                    navigate(callbackUrl || '/', { replace: true });
                    return {};
                } catch (error) {
                    return {
                        error: error instanceof Error ? error.message : 'An error occurred',
                      };
                }
            }}
        />
    )
}

export default Login;
