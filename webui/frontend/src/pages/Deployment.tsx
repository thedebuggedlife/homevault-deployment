// @/pages/Deployment.tsx
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, Alert } from "@mui/material";
import FullPageLayout from "@/layouts/fullpage";
import ConfigurationStep from "@/components/deployment/ConfigurationStep";
import ConfirmationStep from "@/components/deployment/ConfirmationStep";
import DeploymentHeader from "@/components/deployment/DeploymentHeader";
import DeploymentStepper from "@/components/deployment/DeploymentStepper";
import InstallationStep from "@/components/deployment/InstallationStep";
import LoadingState from "@/components/deployment/LoadingState";
import ErrorState from "@/components/deployment/ErrorState";
import { useDeploymentConfig } from "@/hooks/useDeploymentConfig";
import { evaluateCondition } from "@/utils/prompts/conditionEvaluator";
import { DeploymentActivity } from "@backend/types";
import { DeployModules } from "@/types";
import _ from "lodash";
import backend from "@/backend/backend";

export const STEP_CONFIGURATION = 0;
export const STEP_CONFIRMATION = 1;
export const STEP_INSTALLATION = 2;
export const STEP_COMPLETED = 3;

const deploymentSteps = ["Configuration", "Confirmation", "Deployment"];

export interface DeploymentState {
    activity?: DeploymentActivity;
    modules?: DeployModules;
    backPath?: string;
    backTitle?: string;
}

export default function Deployment() {
    const navigate = useNavigate();
    const location = useLocation();
    const [activeStep, setActiveStep] = useState(STEP_CONFIGURATION);
    const [configValues, setConfigValues] = useState<Record<string, string>>({});
    const [userModified, setUserModified] = useState<Record<string, boolean>>({});
    const [startingInstall, setStartingInstall] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activity, setActivity] = useState<DeploymentActivity>();

    const state = location.state as DeploymentState;
    const modules: DeployModules = {
        install: state?.modules?.install ?? activity?.request?.modules?.install ?? [],
        remove: state?.modules?.remove ?? activity?.request?.modules?.remove ?? [],
    };
    const skippedSteps = _.isEmpty(modules.install) ? [STEP_CONFIGURATION] : [];
    console.log("Skipped steps", skippedSteps);
    const {
        config,
        loading: configLoading,
        error: configError,
        reload: reloadConfig,
    } = useDeploymentConfig(modules.install);
    const backPath = state?.backPath ?? "/";
    const backTitle = state?.backTitle ?? "Home";

    // Upon navigation determine what should be the first screen (or navigate back)
    useEffect(() => {
        if (state?.activity) {
            setActivity(state.activity);
            setActiveStep(STEP_INSTALLATION);
        } else if (!_.isEmpty(state?.modules?.remove)) {
            setActiveStep(STEP_CONFIRMATION);
        } else if (_.isEmpty(state?.modules?.install)) {
            navigate(backPath);
        }
    }, [state, navigate, backPath]);

    const handleCompleted = () => {
        setActiveStep(STEP_COMPLETED);
    };

    const handleConfigurationComplete = (values: Record<string, string>) => {
        setConfigValues(values);
        setActiveStep(STEP_CONFIRMATION);
    };

    const handleConfirmDeployment = async () => {
        setError(null);
        setStartingInstall(true);
        try {
            const request = {
                modules: modules,
                config: {
                    variables: filterConfigValues(),
                },
            };
            const { activityId: id } = await backend.startDeployment(request);
            setActivity({ id, type: "deployment", request });
            setActiveStep(STEP_INSTALLATION);
        } catch (error) {
            console.error("Deployment started error", error);
            setError("Failed to start deployment. Please try again.");
        } finally {
            setStartingInstall(false);
        }
    };

    const filterConfigValues = () => {
        const filteredConfigValues: Record<string, string> = {};

        // Only include values for prompts that meet their conditions
        if (config) {
            config.prompts.forEach((prompt) => {
                // Check if this prompt meets its condition
                if (!prompt.condition || evaluateCondition(prompt.condition, configValues)) {
                    // Only include the value if the condition is met
                    if (configValues[prompt.variable] !== undefined) {
                        filteredConfigValues[prompt.variable] = configValues[prompt.variable];
                    }
                }
            });
        }

        // Add administrator fields if base module is being installed
        if (modules.install.includes("base")) {
            if (configValues.ADMIN_USERNAME) {
                filteredConfigValues.ADMIN_USERNAME = configValues.ADMIN_USERNAME;
            }
            if (configValues.ADMIN_EMAIL) {
                filteredConfigValues.ADMIN_EMAIL = configValues.ADMIN_EMAIL;
            }
            if (configValues.ADMIN_PASSWORD) {
                filteredConfigValues.ADMIN_PASSWORD = configValues.ADMIN_PASSWORD;
            }
            if (configValues.ADMIN_DISPLAY_NAME) {
                filteredConfigValues.ADMIN_DISPLAY_NAME = configValues.ADMIN_DISPLAY_NAME;
            }
            // Note: ADMIN_PASSWORD_CONFIRM is intentionally not included
        }

        return filteredConfigValues;
    };

    const handleUserModified = (variable: string) => {
        setUserModified((prev) => ({ ...prev, [variable]: true }));
    };

    const handleBack = () => {
        setActiveStep((prev) => Math.max(0, prev - 1));
    };

    // Show loading state
    if (configLoading) {
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
                    <DeploymentStepper
                        activeStep={activeStep}
                        labels={deploymentSteps}
                        skippedSteps={skippedSteps}
                        activeSpinning={activeStep == STEP_INSTALLATION}
                    />
                </CardContent>
            </Card>

            {activeStep === STEP_CONFIGURATION && config && (
                <Card>
                    <CardContent>
                        <ConfigurationStep
                            modules={modules.install}
                            config={config}
                            initialValues={configValues}
                            userModified={userModified}
                            onUserModified={handleUserModified}
                            onComplete={handleConfigurationComplete}
                        />
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
                            showBack={modules.install.length > 0}
                            startingInstall={startingInstall}
                            onConfirm={handleConfirmDeployment}
                            onBack={handleBack}
                        />
                    </CardContent>
                </Card>
            )}

            {activeStep >= STEP_INSTALLATION && (
                <InstallationStep
                    modules={modules}
                    activity={activity}
                    onReturn={() => navigate(backPath)}
                    backTitle={backTitle}
                    onCompleted={handleCompleted}
                />
            )}
        </FullPageLayout>
    );
}
