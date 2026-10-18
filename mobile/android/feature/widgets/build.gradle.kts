plugins {
    alias(libs.plugins.lpm.android.library)
    alias(libs.plugins.lpm.android.compose)
    alias(libs.plugins.lpm.hilt)
}

dependencies {
    implementation(projects.core.data)
    implementation(projects.core.designsystem)
    implementation(projects.core.push)
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.glance.appwidget)

    testImplementation(projects.core.testing)
    testImplementation(libs.androidx.glance.appwidget.testing)
}
