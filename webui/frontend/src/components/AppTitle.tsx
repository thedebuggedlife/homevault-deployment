import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import { Link, styled, useTheme } from '@mui/material';
import HomeVaultLogo from './HomeVaultLogo';
import DeploymentIndicator from './DeploymentIndicator';

const LogoContainer = styled('div')({
  position: 'relative',
  height: 40,
  display: 'flex',
  alignItems: 'center',
  '& img': {
    maxHeight: 40,
  },
});

/**
 * @ignore - internal component.
 */
export function AppTitle() {
  const theme = useTheme();
  return (
    <Stack direction="row" alignItems="center">
      <Link href='/' style={{ textDecoration: 'none' }}>
        <Stack direction="row" alignItems="center">
          <LogoContainer><HomeVaultLogo size={40} /></LogoContainer>
          <Typography
            variant="h6"
            sx={{
              color: (theme.vars ?? theme).palette.primary.main,
              fontWeight: '700',
              ml: 1,
              whiteSpace: 'nowrap',
              lineHeight: 1,
            }}
          >
            HomeVault
          </Typography>
        </Stack>
      </Link>
      <DeploymentIndicator/>
    </Stack>
  );
}