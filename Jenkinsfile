pipeline {
  agent any

  parameters {
    string(name: 'TARGET_APP_ROOT', defaultValue: '/var/www/pf-beta/public/app-platform/apps/tailorkit', description: 'TailorKit static target app root')
    choice(name: 'PROMOTE_STRATEGY', choices: ['copy', 'symlink'], description: 'current promotion strategy')
    booleanParam(name: 'SOURCE_MIGRATED', defaultValue: false, description: 'Run build/deploy stages after TailorKit source lands')
    booleanParam(name: 'DEPLOY', defaultValue: false, description: 'Run deploy after dry-run')
  }

  stages {
    stage('Install') {
      steps {
        sh 'npm install'
      }
    }

    stage('Contract') {
      steps {
        sh 'npm run ci:contract'
      }
    }

    stage('Build Artifact') {
      when {
        expression { return params.SOURCE_MIGRATED }
      }
      steps {
        sh 'npm run build:admin-artifact'
      }
    }

    stage('Deploy Dry Run') {
      when {
        expression { return params.SOURCE_MIGRATED }
      }
      steps {
        sh '''
          npm run deploy:admin-artifact:dry-run -- \
            --artifact artifacts/tailorkit-admin-static \
            --target-app-root "$TARGET_APP_ROOT" \
            --strategy "$PROMOTE_STRATEGY"
        '''
      }
    }

    stage('Deploy') {
      when {
        expression { return params.SOURCE_MIGRATED && params.DEPLOY }
      }
      steps {
        sh '''
          npm run deploy:admin-artifact -- \
            --artifact artifacts/tailorkit-admin-static \
            --target-app-root "$TARGET_APP_ROOT" \
            --strategy "$PROMOTE_STRATEGY"
        '''
      }
    }
  }
}
