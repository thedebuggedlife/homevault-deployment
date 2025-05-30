import { Stepper, Step, StepLabel, StepIcon, StepIconProps, CircularProgress } from '@mui/material';

interface DeploymentStepperProps {
    activeStep: number;
    isInstalling: boolean;
    steps: string[];
}

export default function DeploymentStepper({ activeStep, isInstalling, steps }: DeploymentStepperProps) {
    const stepIcon = (props: StepIconProps) => 
        isInstalling && props.active ? (
            <CircularProgress size={24} thickness={4} />
        ) : (
            <StepIcon {...props} />
        );

    return (
        <Stepper activeStep={activeStep}>
            {steps.map((label) => (
                <Step key={label}>
                    <StepLabel StepIconComponent={stepIcon}>
                        {label}
                    </StepLabel>
                </Step>
            ))}
        </Stepper>
    );
}