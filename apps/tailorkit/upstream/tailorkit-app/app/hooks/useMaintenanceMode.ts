import { useEffect } from 'react'
import { useLocation, useNavigate } from '@remix-run/react'

/**
 * Hook to handle maintenance mode redirection
 * @param isMaintenanceMode - Boolean flag indicating if maintenance mode is active
 */
export function useMaintenanceMode(isMaintenanceMode: boolean) {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const maintenance_mode_path = '/maintenance-mode'

    if (isMaintenanceMode && !location.pathname.includes(maintenance_mode_path)) {
      navigate(maintenance_mode_path)
    }
  }, [location.pathname, isMaintenanceMode, navigate])
}
