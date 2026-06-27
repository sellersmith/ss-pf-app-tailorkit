pipeline {
  agent any

  parameters {
    string(name: 'TARGET_APP_ROOT', defaultValue: '', description: 'Required environment-specific TailorKit static target app root')
    choice(name: 'PROMOTE_STRATEGY', choices: ['copy', 'symlink'], description: 'current promotion strategy')
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
        sh 'test -n "$TARGET_APP_ROOT"'
      }
    }

    stage('Build Artifact') {
      steps {
        sh 'npm run build:admin-artifact'
      }
    }

    stage('Deploy Dry Run') {
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
        expression { return params.DEPLOY }
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
