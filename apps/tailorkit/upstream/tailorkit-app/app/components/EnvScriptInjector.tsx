interface EnvScriptInjectorProps {
  publicEnv: Record<string, unknown>
}

export function EnvScriptInjector({ publicEnv }: EnvScriptInjectorProps) {
  return (
    <script
      /**
       * Set up public environment variables
       * @see https://remix.run/docs/hi/main/guides/envvars#environment-variables
       */
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{
        __html: `window.PUBLIC_ENV = ${JSON.stringify(publicEnv)}`,
      }}
    />
  )
}
