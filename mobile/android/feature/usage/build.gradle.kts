plugins {
    alias(libs.plugins.lpm.android.feature)
    alias(libs.plugins.kotlin.serialization)
}

dependencies {
    implementation(projects.core.ui)
    implementation(libs.androidx.glance.appwidget)
    implementation(libs.androidx.lifecycle.process)

    testImplementation(projects.core.testing)
    testImplementation(libs.androidx.glance.appwidget.testing)
}
