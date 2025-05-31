// @/pages/Deployment.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, Alert } from "@mui/material";
import FullPageLayout from "@/layouts/fullpage";
import ConfigurationStep from "@/components/deployment/ConfigurationStep";
import ConfirmationStep from "@/components/deployment/ConfirmationStep";
import DeploymentHeader from "@/components/deployment/DeploymentHeader";
import DeploymentStepper from "@/components/deployment/DeploymentStepper";
import InstallationStep from "@/components/deployment/InstallationStep";
import PasswordDialog from "@/components/deployment/PasswordDialog";
import LoadingState from "@/components/deployment/LoadingState";
import ErrorState from "@/components/deployment/ErrorState";
import { useDeploymentState } from "@/hooks/useDeploymentState";
import { useDeploymentConfig } from "@/hooks/useDeploymentConfig";
import { useDeploymentOperation } from "@/hooks/useDeploymentOperation";

const STEP_CONFIGURATION = 0;
const STEP_CONFIRMATION = 1;
const STEP_INSTALLATION = 2;

const deploymentSteps = ["Configuration", "Confirmation", "Deployment"];

export default function Deployment() {
    const navigate = useNavigate();
    const { modules, backPath, backTitle } = useDeploymentState();
    const { config, loading: configLoading, error: configError, reload: reloadConfig } = useDeploymentConfig(modules.install);
    const {
        output,
        operation,
        activity,
        loading: deploymentLoading,
        error: deploymentError,
        startDeployment,
        checkCurrentDeployment,
    } = useDeploymentOperation();
    const [activeStep, setActiveStep] = useState(STEP_CONFIGURATION);
    const [configValues, setConfigValues] = useState<Record<string, string>>({});
    const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Determine which output to show (existing deployment or new deployment)
    const displayError = deploymentError || error;
    const displayModules = activity?.request?.modules ? {
        install: activity?.request?.modules.install ?? [],
        remove: activity?.request?.modules.remove ?? [],
    } : modules;
    const hasInstallations = displayModules.install.length > 0;
    const hasRemovals = displayModules.remove.length > 0;
    const hasModules = hasInstallations || hasRemovals;

    // Check for ongoing deployment on mount
    useEffect(() => {
        if (operation?.isInstalling) {
            // If there's an ongoing deployment, jump to installation step
            setActiveStep(STEP_INSTALLATION);
        }
        else if (activeStep == STEP_CONFIGURATION && !hasModules) {
            setActiveStep(STEP_CONFIRMATION);
        }
    }, [hasModules, activeStep, operation?.isInstalling]);

    // Redirect if no modules and no active deployment
    useEffect(() => {
        const modulesProvided = modules.install.length + modules.remove.length;
        if (modulesProvided === 0 && !deploymentLoading && !deploymentError && !operation) {
            navigate(backPath);
        }
    }, [modules, deploymentLoading, deploymentError, operation, navigate, backPath]);

    const handleConfigurationComplete = (values: Record<string, string>) => {
        setConfigValues(values);
        setActiveStep(STEP_CONFIRMATION);
    };

    const handleConfirmDeployment = () => {
        setPasswordDialogOpen(true);
    };

    const handlePasswordSubmit = async (password: string) => {
        setPasswordDialogOpen(false);
        setActiveStep(STEP_INSTALLATION);
        setError(null);

        try {
            await startDeployment({
                modules: modules,
                config: {
                    variables: configValues,
                    password,
                },
            });
        } catch (err) {
            setError("Failed to start deployment. Please try again.");
            setActiveStep(STEP_CONFIRMATION);
        }
    };

    const handlePasswordCancel = () => {
        setPasswordDialogOpen(false);
    };

    const handleBack = () => {
        setActiveStep((prev) => Math.max(0, prev - 1));
    };

    const handleAbort = () => {
        operation?.abort();
    }

    // Show loading state
    if (configLoading || deploymentLoading) {
        return <LoadingState title="Module Deployment" backPath={backPath} backTitle={backTitle} />;
    }

    if (configError) {
        return (
            <ErrorState
                error={configError}
                onRetry={reloadConfig}
                title="Module Deployment"
                backPath={backPath}
                backTitle={backTitle}
            />
        );
    }

    if (deploymentError && !operation) {
        return (
            <ErrorState
                error={deploymentError}
                onRetry={checkCurrentDeployment}
                title="Module Deployment"
                backPath={backPath}
                backTitle={backTitle}
            />
        );
    }

    return (
        <FullPageLayout
            headerContent={<DeploymentHeader backTitle={backTitle} onBack={() => navigate(backPath)} />}
            title="Module Deployment"
        >
            {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                </Alert>
            )}

            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <DeploymentStepper activeStep={activeStep} isInstalling={operation?.isInstalling} steps={deploymentSteps} />
                </CardContent>
            </Card>

            {activeStep === STEP_CONFIGURATION && config && (
                <Card>
                    <CardContent>
                        <ConfigurationStep modules={modules.install} config={config} onComplete={handleConfigurationComplete} />
                    </CardContent>
                </Card>
            )}

            {activeStep === STEP_CONFIRMATION && (
                <Card>
                    <CardContent>
                        <ConfirmationStep
                            modules={modules}
                            config={config}
                            values={configValues}
                            onConfirm={handleConfirmDeployment}
                            onBack={handleBack}
                        />
                    </CardContent>
                </Card>
            )}

            {activeStep === STEP_INSTALLATION && (
                <InstallationStep
                    modules={displayModules}
                    isInstalling={operation?.isInstalling}
                    output={output}
                    error={displayError}
                    onReturn={() => navigate(backPath)}
                    handleAbort={handleAbort}
                    backTitle={backTitle}
                />
            )}

            <PasswordDialog
                open={passwordDialogOpen}
                username={config?.username ?? "installer"}
                onSubmit={handlePasswordSubmit}
                onCancel={handlePasswordCancel}
            />
        </FullPageLayout>
    );
}
