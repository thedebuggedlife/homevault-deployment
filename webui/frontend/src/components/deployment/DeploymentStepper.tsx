import { Stepper, Step, StepLabel, StepIcon, StepIconProps, CircularProgress } from '@mui/material';

interface DeploymentStepperProps {
    activeStep: number;
    labels: string[];
    skippedSteps: number[];
    activeSpinning: boolean;
}

export default function DeploymentStepper({ activeStep, labels, skippedSteps, activeSpinning }: DeploymentStepperProps) {
    const stepIcon = (props: StepIconProps) => 
        activeSpinning && props.active ? (
            <CircularProgress size={24} thickness={4} />
        ) : (
            <StepIcon {...props} />
        );
    const isStepCompleted = (index: number): boolean|undefined => {
        if (skippedSteps.includes(index)) {
            console.log(`Step ${index} is skipped!`);
            return false;
        }
    }
    return (
        <Stepper activeStep={activeStep}>
            {labels.map((label, index) => (
                <Step key={label} completed={isStepCompleted(index)}>
                    <StepLabel slots={{stepIcon}}>
                        {label}
                    </StepLabel>
                </Step>
            ))}
        </Stepper>
    );
}