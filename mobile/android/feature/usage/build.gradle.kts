plugins {
    alias(libs.plugins.lpm.android.feature)
    alias(libs.plugins.kotlin.serialization)
}

dependencies {
    implementation(projects.core.ui)
    implementation(libs.androidx.glance.appwidget)

    testImplementation(projects.core.testing)
}
